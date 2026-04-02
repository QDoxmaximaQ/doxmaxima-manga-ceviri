// app/ocr/arkaplan/gemini-nano.ts

/**
 * Gemini Nano (Banana) Inpainting modeli ile arkaplan temizleme.
 * 
 * @param imageSource İşlenecek manga sayfasının orijinal resmi (Base64 veya URL)
 * @param safeBoxes Mavi alanlar (korunacak / inpainting dışı bırakılacak alanlar)
 * @param targetBoxes Mor alanlar (silinecek / yeniden çizilecek alanlar)
 * @param scaleX X ekseni ölçeği (canvas -> orijinal resim)
 * @param scaleY Y ekseni ölçeği (canvas -> orijinal resim)
 * @returns İşlenmiş resmin Base64 verisi veya URL'i
 */
export async function processWithGeminiNano(
    imageSource: string, 
    safeBoxes: Array<{x: number, y: number, w: number, h: number}>,
    targetBoxes: Array<{x: number, y: number, w: number, h: number}>,
    scaleX: number,
    scaleY: number
) {
    console.log("[Gemini Nano] Inpainting işlemi başlatılacak...");

    const nanoBananaKey = localStorage.getItem("nanoBananaApiKey");
    if (!nanoBananaKey) {
        throw new Error("Nano Banana API Adresi veya Anahtarı ayarlardan girilmemiş.");
    }

    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            // Sadece OCR hedeflerini barındıran şeffaf maske (Kompozit işlem / Kesme için)
            const transMaskCanvas = document.createElement("canvas");
            transMaskCanvas.width = img.width;
            transMaskCanvas.height = img.height;
            const ctxTransMask = transMaskCanvas.getContext("2d");
            if (!ctxTransMask) return reject(new Error("TransMask Canvas context oluşturulamadı."));

            ctxTransMask.fillStyle = "white";
            for (const box of targetBoxes) {
                const realW = box.w / scaleX;
                const realH = box.h / scaleY;
                // Dinamik padding
                const padding = Math.min(12, Math.max(2, Math.min(realW, realH) * 0.1));
                const x = (box.x / scaleX) - padding;
                const y = (box.y / scaleY) - padding;
                const w = realW + (padding * 2);
                const h = realH + (padding * 2);
                ctxTransMask.fillRect(x, y, w, h);
            }

            // API'ye göndermek için Siyah-Beyaz Maske
            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = img.width;
            maskCanvas.height = img.height;
            const ctxMask = maskCanvas.getContext("2d");
            if (!ctxMask) return reject(new Error("Mask Canvas context oluşturulamadı."));

            ctxMask.fillStyle = "black";
            ctxMask.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            ctxMask.drawImage(transMaskCanvas, 0, 0);

            // Orijinal Resmi Canvas'a çizerek veriyi alma
            const imgCanvas = document.createElement("canvas");
            imgCanvas.width = img.width;
            imgCanvas.height = img.height;
            const ctxImg = imgCanvas.getContext("2d");
            if (!ctxImg) return reject(new Error("Görsel Canvas context alınamadı."));
            ctxImg.drawImage(img, 0, 0);

            const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
                return new Promise((res, rej) => {
                    canvas.toBlob((blob) => {
                        if (blob) res(blob);
                        else rej(new Error("Canvas blob'a çevrilemedi."));
                    }, "image/png");
                });
            };

            try {
                const imageBlob = await getCanvasBlob(imgCanvas);
                const maskBlob = await getCanvasBlob(maskCanvas);

                if (imageBlob.size === 0 || maskBlob.size === 0) {
                    throw new Error(`Blob boyutları hatalı! Image: ${imageBlob.size}, Mask: ${maskBlob.size}`);
                }

                console.log("[Gemini Nano Banana] Google AI Studio'ya istek hazırlanıyor...");
                
                // Resmi Base64'e çeviriyoruz çünkü Google AI Studio FormData değil, JSON (Base64) kabul eder
                const blobToBase64 = (blob: Blob): Promise<string> => {
                    return new Promise((r, j) => {
                        const reader = new FileReader();
                        reader.onloadend = () => r((reader.result as string).split(',')[1]);
                        reader.onerror = j;
                        reader.readAsDataURL(blob);
                    });
                };

                const base64Image = await blobToBase64(imageBlob);
                const base64Mask = await blobToBase64(maskBlob);

                // Google AI Studio URL'si: Gemini 2.0 Flash (Ücretsiz Hesapta Denemek İçin)
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${nanoBananaKey.trim()}`;

                const requestBody = {
                    contents: [{
                        parts: [
                            { text: "Please perform inpainting on the provided original image using the provided mask image. The areas marked with white on the mask image should be removed and smoothly completely reconstructed to match the surrounding manga background art style without text. Return ONLY the edited image as the response." },
                            { inlineData: { mimeType: "image/png", data: base64Image } },
                            { inlineData: { mimeType: "image/png", data: base64Mask } }
                        ]
                    }]
                };

                // Beklenen API çağrısı
                let response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    let errText = await response.text().catch(() => "");
                    throw new Error(`Google AI Studio Hatası (${response.status}): ${errText.slice(0, 500)}`);
                }

                const responseData = await response.json();
                console.log("[Gemini Nano Banana] API Cevabı Alındı. Boyut Kontrolü:", JSON.stringify(responseData).length);

                const responseParts = responseData.candidates?.[0]?.content?.parts;
                if (!responseParts || responseParts.length === 0) {
                    throw new Error("Gemini API'den boş yanıt geldi.");
                }

                const geminiTextResponse = responseParts.find((p: any) => p.text)?.text;
                const geminiImageResponse = responseParts.find((p: any) => p.inlineData?.data)?.inlineData?.data;

                if (!geminiImageResponse) {
                    // Eğer resim veremezse veya inpainting yapamazsa gönderdiği metin hatasını bas.
                    throw new Error(`Gemini resim (.png) üretmedi. Metin Cevabı: "${geminiTextResponse || 'Hata metni yok.'}"`);
                }

                // API'den base64 dönen resmi URL formatına çeviriyoruz
                const resultUrl = `data:image/png;base64,${geminiImageResponse}`;

                // API'den dönen resmi yüklüyoruz
                const inpaintedImg = new Image();
                inpaintedImg.onload = () => {
                    
                    const finalCanvas = document.createElement("canvas");
                    finalCanvas.width = img.width;
                    finalCanvas.height = img.height;
                    const ctxFinal = finalCanvas.getContext("2d");
                    if (!ctxFinal) return reject(new Error("Final Canvas hazırlanamadı."));

                    // 1. Önce bozulmamasını istediğimiz ana orijinal resmi tam boyutta çiziyoruz
                    ctxFinal.drawImage(img, 0, 0);

                    // 2. Sadece OCR (hedef resim) alanlarını orijinal resimden 'destination-out' ile oyup çıkarıyoruz
                    ctxFinal.globalCompositeOperation = "destination-out";
                    ctxFinal.drawImage(transMaskCanvas, 0, 0);

                    // 3. API'den gelen boyanmış/inpainted arka planı en alt katmana çiziyoruz. 
                    // Yalnızca oyduğumuz OCR bölgelerinden gözükecektir, böylece ana resmin geri kalanı %100 aynısı kalır.
                    ctxFinal.globalCompositeOperation = "destination-over";
                    ctxFinal.drawImage(inpaintedImg, 0, 0);

                    // Normal çizim moduna dön
                    ctxFinal.globalCompositeOperation = "source-over";

                    finalCanvas.toBlob((blob) => {
                        if (blob) {
                            console.log("[Gemini Nano] İşlem başarıyla tamamlandı (Kompozit Katman).");
                            resolve(URL.createObjectURL(blob));
                        } else {
                            reject(new Error("Final canvas oluşturulamadı."));
                        }
                    }, "image/png");
                };

                inpaintedImg.onerror = () => {
                    reject(new Error("API'den dönen sonuç imaj olarak yüklenemedi."));
                };
                
                inpaintedImg.src = resultUrl;

            } catch (err: any) {
                console.error("[Gemini Nano] Hata detayı:", err);
                reject(new Error(err.message || "Gemini Nano işlemi sırasında hata oluştu."));
            }
        };

        img.onerror = () => {
            reject(new Error("İşlenecek resim yüklenemedi. (gemini nano)"));
        };

        img.src = imageSource;
    });
}
