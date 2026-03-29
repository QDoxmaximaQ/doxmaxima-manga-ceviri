// app/ocr/arkaplan/lama.ts

/**
 * LaMa (Large Mask Inpainting) modeli ile arkaplan temizleme.
 * 
 * @param imageSource İşlenecek manga sayfasının orijinal resmi (Base64 veya URL)
 * @param safeBoxes Mavi alanlar (korunacak / inpainting dışı bırakılacak alanlar)
 * @param targetBoxes Mor alanlar (silinecek / yeniden çizilecek alanlar)
 * @param scaleX X ekseni ölçeği (canvas -> orijinal resim)
 * @param scaleY Y ekseni ölçeği (canvas -> orijinal resim)
 * @returns İşlenmiş resmin Base64 verisi veya URL'i
 */
export async function processWithLama(
    imageSource: string,
    safeBoxes: Array<{ x: number, y: number, w: number, h: number }>,
    targetBoxes: Array<{ x: number, y: number, w: number, h: number }>,
    scaleX: number,
    scaleY: number
) {
    console.log("[Lama] Inpainting işlemi başlatılacak...");

    const lamaUrl = localStorage.getItem("lamaApiKey");
    if (!lamaUrl) {
        throw new Error("Lama API adresi (URL / Hugging Face Space) ayarlardan girilmemiş.");
    }

    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            // Maske oluşturmak için canvas yaratıyoruz
            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = img.width;
            maskCanvas.height = img.height;
            const ctxMask = maskCanvas.getContext("2d");

            if (!ctxMask) {
                return reject(new Error("Canvas context oluşturulamadı."));
            }

            // Arkaplanı tamamen siyah yapıyoruz (İnpaing dışı yerler)
            ctxMask.fillStyle = "black";
            ctxMask.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

            // Hedef kutuları beyaz ile çiziyoruz (Maske)
            ctxMask.fillStyle = "white";
            // Yazı kenarlarında kalan siyah stroke veya izlerin silinmesi için taşma payı (padding) dinamik olarak ayarlanır.
            // Küçük baloncuklarda 12px çok taşma yapıp arkaplanı bozduğundan resim alanına oranlanır.
            for (const box of targetBoxes) {
                const realW = box.w / scaleX;
                const realH = box.h / scaleY;
                // Dinamik padding hesabı: Kısa kenarın %15'i kadar, en az 2px, en fazla 12px 
                const padding = Math.min(12, Math.max(2, Math.min(realW, realH) * 0.1));
                const x = (box.x / scaleX) - padding;
                const y = (box.y / scaleY) - padding;
                const w = realW + (padding * 2);
                const h = realH + (padding * 2);
                ctxMask.fillRect(x, y, w, h);
            }

            // Orijinal Resmi Canvas'a çizerek güvenli bir Blob nesnesi çıkarıyoruz
            const imgCanvas = document.createElement("canvas");
            imgCanvas.width = img.width;
            imgCanvas.height = img.height;
            const ctxImg = imgCanvas.getContext("2d");
            if (!ctxImg) return reject(new Error("Görsel Canvas context alınamadı."));
            ctxImg.drawImage(img, 0, 0);

            // Canvasları Blob nesnelerine çeviren Helper
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
                    throw new Error(`Blob boyutları 0 byte! Image: ${imageBlob.size}, Mask: ${maskBlob.size}`);
                }

                const formatHfSpaceUrl = (url: string) => {
                    if (url.includes("huggingface.co/spaces/")) {
                        const parts = url.split("huggingface.co/spaces/")[1].split("/");
                        if (parts.length >= 2) {
                            const author = parts[0];
                            const spaceName = parts[1];
                            return `https://${author}-${spaceName}.hf.space`;
                        }
                    }
                    return url;
                };

                const baseUrl = formatHfSpaceUrl(lamaUrl).replace(/\/+$/, '');
                const endpoint = `${baseUrl}/inpaint`;

                console.log("[Lama] İstek gönderiliyor (Native API):", endpoint);

                const formData = new FormData();
                formData.append("image", imageBlob, "image.png");
                formData.append("mask", maskBlob, "mask.png");
                formData.append("sizeLimit", "1080");
                formData.append("hdStrategy", "Crop");
                formData.append("cv2Radius", "4");
                formData.append("zitsWireframe", "false");
                formData.append("zitsEdgeLine", "false");
                formData.append("hdStrategyCropMargin", "128");
                formData.append("hdStrategyCropTrigerSize", "2048");
                formData.append("hdStrategyResizeLimit", "2048");
                formData.append("prompt", "");
                formData.append("negativePrompt", "");
                formData.append("negative_prompt", "");
                formData.append("croperX", "0");
                formData.append("croperY", "0");
                formData.append("croperHeight", "512");
                formData.append("croperWidth", "512");
                formData.append("useCroper", "false");
                formData.append("ldmSteps", "25");
                formData.append("ldmSampler", "plms");
                formData.append("sdMaskBlur", "0");
                formData.append("sdOutpaintingMargin", "0");
                formData.append("sdOutpaintingAlignment", "0");
                formData.append("cv2Flag", "INPAINT_NS");

                // Eksik olan ama Lama Cleaner (1.2.5) Flask API'sinin beklediği zorunlu anahtarlar:
                formData.append("sdScale", "1.0");
                formData.append("sdStrength", "0.75");
                formData.append("sdSteps", "50");
                formData.append("sdGuidanceScale", "7.5");
                formData.append("sdSampler", "uni_pc");
                formData.append("sdSeed", "-1");
                formData.append("sdMatchHistograms", "false");
                formData.append("paintByExampleSteps", "50");
                formData.append("paintByExampleGuidanceScale", "7.5");
                formData.append("paintByExampleMaskBlur", "0");
                formData.append("paintByExampleSeed", "-1");
                formData.append("paintByExampleMatchHistograms", "false");
                formData.append("p2pSteps", "50");
                formData.append("p2pImageGuidanceScale", "1.5");
                formData.append("p2pGuidanceScale", "7.5");
                formData.append("controlnet_conditioning_scale", "0.4");
                formData.append("controlnet_method", "control_v11p_sd15_canny");

                let response = await fetch(endpoint, {
                    method: "POST",
                    body: formData
                });

                // Eğer /inpaint 404, 405 veya 400 dönerse (IOPaint durumunda endpoint /api/v1/inpaint olabilir) fallback yap
                if (response.status === 404 || response.status === 405) {
                    // Not: 400 hatası eksik form datasından kaynaklanır, bu yüzden onu fallback'ten çıkardık.
                    console.warn("[Lama] /inpaint başarısız oldu, /api/v1/inpaint deneniyor...");
                    const fallbackEndpoint = `${baseUrl}/api/v1/inpaint`;

                    const fallbackFormData = new FormData();
                    // FormData içeriğini kopyala
                    for (const [key, value] of formData.entries()) {
                        fallbackFormData.append(key, value);
                    }

                    response = await fetch(fallbackEndpoint, {
                        method: "POST",
                        body: fallbackFormData
                    });
                }

                if (!response.ok) {
                    let errText = "";
                    try {
                        errText = await response.text();
                    } catch (e) { }
                    console.error(`[Lama] API Hatası Detayları (Status ${response.status}):`, errText);
                    throw new Error(`API isteği başarısız oldu. (Tip: ${response.status} ${response.statusText}). Detay: ${errText.slice(0, 100)}...`);
                }

                const resultBlob = await response.blob();
                const resultUrl = URL.createObjectURL(resultBlob);

                console.log("[Lama] İşlem başarılı! Bloba dönüştürüldü.");
                resolve(resultUrl);

            } catch (err: any) {
                console.error("[Lama] Hata detayı:", err);
                reject(new Error("Lama işlemi sırasında bir hata oluştu: " + err.message));
            }
        };

        img.onerror = () => {
            reject(new Error("İşlenecek resim yüklenemedi. (lama)"));
        };

        // Resim base64 verisi atandığında onload tetiklenir
        img.src = imageSource;
    });
}

