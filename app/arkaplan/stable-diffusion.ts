// app/arkaplan/stable-diffusion.ts

export async function processWithStableDiffusion(
    imageSource: string, 
    safeBoxes: Array<{x: number, y: number, w: number, h: number}>,
    targetBoxes: Array<{x: number, y: number, w: number, h: number}>,
    scaleX: number,
    scaleY: number
): Promise<string> {
    console.log("[Stable Diffusion] Inpainting işlemi başlatılacak...");

    const sdUrl = localStorage.getItem("sdApiKey");
    if (!sdUrl) {
        throw new Error("Stable Diffusion API Adresi ayarlardan girilmemiş.");
    }

    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas context oluşturulamadı."));

            // 1. Orijinal resmi çiziyoruz.
            ctx.drawImage(img, 0, 0);

            // 2. Orijinal resmin Base64 değerini alıyoruz (init_image)
            const initImageBase64 = canvas.toDataURL("image/png").split(",")[1];

            // 3. Maskeyi oluşturuyoruz (A1111 için siyah arka plan üzerine beyaz maske önerilir)
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";

            // Maskeyi targetBoxes alanlarına göre boyuyoruz
            for (const box of targetBoxes) {
                const bx = Math.round(box.x / scaleX) - 5;
                const by = Math.round(box.y / scaleY) - 5;
                const bw = Math.round(box.w / scaleX) + 10;
                const bh = Math.round(box.h / scaleY) + 10;
                ctx.fillRect(bx, by, bw, bh);
            }

            // Mavi/Korunacak alanlar (safeBoxes) varsa siyah olarak tekrar boya
            ctx.fillStyle = "black";
            for (const box of safeBoxes) {
                const bx = Math.round(box.x / scaleX);
                const by = Math.round(box.y / scaleY);
                const bw = Math.round(box.w / scaleX);
                const bh = Math.round(box.h / scaleY);
                ctx.fillRect(bx, by, bw, bh);
            }

            const maskBase64 = canvas.toDataURL("image/png").split(",")[1];

            console.log("[Stable Diffusion] API'ye istek hazırlanıyor...", sdUrl);

            // Automatic1111 /sdapi/v1/img2img Standart Gövdesi (Payload)
            const payload = {
                init_images: [initImageBase64],
                mask: maskBase64,
                inpainting_fill: 1, // 1: original, 2: latent noise, 3: latent nothing
                inpaint_full_res: true,
                inpaint_full_res_padding: 32,
                inpainting_mask_invert: 0,
                prompt: "smooth manga background, clean lines, seamless, no text, no bubbles, black and white manga style",
                negative_prompt: "text, watermark, writing, bubbles, dialogue, messy, weird",
                denoising_strength: 0.75, // Yüksek olmalı ki text tamamen yok olsun
                steps: 20,
                cfg_scale: 7,
                sampler_name: "Euler a"
            };

            try {
                const response = await fetch(sdUrl.trim(), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    let errText = await response.text().catch(() => "");
                    throw new Error(`SD API Hatası (${response.status}): ${errText.slice(0, 200)}...`);
                }

                const data = await response.json();
                
                if (!data.images || data.images.length === 0) {
                    throw new Error("Stable Diffusion API'den geçerli resim verisi dönmedi.");
                }

                // SD base64 döndürür, formatına image/png ekleyerek url oluşturuyoruz
                const resultUrl = "data:image/png;base64," + data.images[0];
                
                console.log("[Stable Diffusion] İşlem başarılı! Yeni resim çizilecek.");
                
                // Maske kompozitleme işlemi (Aynı LaMa gibi orjinal resmi koruması için)
                const inpaintedImg = new Image();
                inpaintedImg.onload = () => {
                    const finalCanvas = document.createElement("canvas");
                    finalCanvas.width = img.width;
                    finalCanvas.height = img.height;
                    const finalCtx = finalCanvas.getContext("2d");
                    if (!finalCtx) return reject("Final canvas context hatası.");

                    finalCtx.drawImage(img, 0, 0);
                    finalCtx.globalCompositeOperation = "destination-out";

                    finalCtx.fillStyle = "black";
                    for (const box of targetBoxes) {
                        const bx = Math.round(box.x / scaleX) - 5;
                        const by = Math.round(box.y / scaleY) - 5;
                        const bw = Math.round(box.w / scaleX) + 10;
                        const bh = Math.round(box.h / scaleY) + 10;
                        finalCtx.fillRect(bx, by, bw, bh);
                    }

                    finalCtx.globalCompositeOperation = "destination-over";
                    finalCtx.drawImage(inpaintedImg, 0, 0);

                    resolve(finalCanvas.toDataURL("image/png"));
                };

                inpaintedImg.onerror = () => reject(new Error("Stable Diffusion çıktısı resme dönüştürülemedi."));
                inpaintedImg.src = resultUrl;

            } catch (error: any) {
                console.error("[Stable Diffusion]", error);
                reject(error);
            }
        };

        img.onerror = () => reject(new Error("İşlenecek resim yüklenemedi. (Stable Diffusion)"));
        img.src = imageSource;
    });
}
