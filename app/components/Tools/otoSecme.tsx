// app/components/Tools/otoSecme.tsx
"use client";

import React from "react";
import { MangaPage } from "../hooks/useLayers";
import { Wand2 } from "lucide-react";

export default function Otosecme({ isActive, onClick }: any) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                    : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Yapay Zeka ile Oto Seçim"
            >
                <Wand2 size={18} />
            </button>
        </section>
    );
}

/**
 * Canvas.tsx içindeki canvasSize hesaplama mantığıyla aynı.
 * Orijinal resim boyutundan görüntüleme boyutunu hesaplar.
 */
function calcDisplaySize(origW: number, origH: number) {
    const baseW = 840;
    const baseH = 1200;
    if (origH >= origW) {
        return {
            displayW: Math.round(baseH * (origW / origH)),
            displayH: baseH
        };
    } else {
        return {
            displayW: baseW,
            displayH: Math.round(baseW * (origH / origW))
        };
    }
}

export function useAutoSelection(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setIsProcessing: (val: boolean) => void
) {
    const triggerAI = async (clickX?: number, clickY?: number) => {
        if (!activePageId) {
            alert("Lütfen önce bir resim seçin!");
            return;
        }

        const activePage = pages.find(p => p.id === activePageId);
        if (!activePage || !activePage.url) return;

        const engine = localStorage.getItem("ocrEngine") || "tesseract";
        setIsProcessing(true);

        try {
            // --- 1. ORİJİNAL RESİM BOYUTLARINI AL ---
            // Canvas div'i resmi 840x1200 içinde sığdırarak gösteriyor.
            // Tesseract ise resmin orijinal pixel boyutunda koordinat döndürüyor.
            // İkisini eşleştirmek için ölçek faktörü hesaplıyoruz.
            const origDimensions = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => {
                    console.warn("Resim boyutu alınamadı, 1:1 ölçek kullanılıyor.");
                    resolve({ w: 840, h: 1200 });
                };
                img.src = activePage.url;
            });

            const { displayW, displayH } = calcDisplaySize(origDimensions.w, origDimensions.h);
            const scaleX = displayW / origDimensions.w;
            const scaleY = displayH / origDimensions.h;

            console.log(`[OtoSecme] Orijinal boyut: ${origDimensions.w}x${origDimensions.h}`);
            console.log(`[OtoSecme] Canvas görüntüleme boyutu: ${displayW}x${displayH}`);
            console.log(`[OtoSecme] Ölçek faktörü → X: ${scaleX.toFixed(4)}, Y: ${scaleY.toFixed(4)}`);

            // --- 2. OCR ÇALIŞTIR ---
            let results: any[] = [];

            if (engine === "ocrspace") {
                const { recognizeWithOCRSpace } = await import("../../ocr/ocrspace");
                const apiKey = localStorage.getItem("ocrspaceApiKey");
                if (!apiKey) {
                    alert("Lütfen Ayarlar sayfasından OCR.Space API Key girin!");
                    setIsProcessing(false);
                    return;
                }
                results = await recognizeWithOCRSpace(activePage.url, apiKey);
            } else if (engine === "paddleocr") {
                const { recognizeWithPaddleOCR } = await import("../../ocr/paddleocr");
                const endpointUrl = localStorage.getItem("paddleOcrUrl") || "";
                results = await recognizeWithPaddleOCR(activePage.url, endpointUrl);
            } else if (engine === "easyocr") {
                const { recognizeWithEasyOCR } = await import("../../ocr/easyocr");
                const endpointUrl = localStorage.getItem("easyOcrUrl") || "Doxmaxima/EasyOCR-v1";
                results = await recognizeWithEasyOCR(activePage.url, endpointUrl);
            }

            console.log(`[OtoSecme] OCR ham sonuç sayısı: ${results.length}`);
            if (results.length > 0) {
                console.log("[OtoSecme] İlk sonuç örneği:", results[0]);
            }

            if (results && results.length > 0) {
                setPages(prev => prev.map(page => {
                    if (page.id !== activePageId) return page;

                    const newLayers = results.map((res: any, idx: number) => {
                        // --- 3. KOORDİNATLARI CANVAS BOYUTUNA ÖLÇEKLE ---
                        // Tesseract → orijinal resim piksel koordinatı
                        // Canvas div  → görüntüleme boyutunda
                        const rawX = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                        const rawY = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;

                        const x = rawX * scaleX;
                        const y = rawY * scaleY;
                        const w = res.width * scaleX;
                        const h = res.height * scaleY;

                        console.log(`[OtoSecme] Katman ${idx + 1}: "${res.text}" | Ham(${rawX.toFixed(0)},${rawY.toFixed(0)}) → Ölçekli(${x.toFixed(0)},${y.toFixed(0)}) w:${w.toFixed(0)} h:${h.toFixed(0)}`);

                        return {
                            id: `layer-ai-${Date.now()}-${idx}`,
                            name: `AI Seçim ${idx + 1}`,
                            isVisible: true,
                            selection: { x, y, w, h },
                            text: res.text,
                        };
                    });

                    return {
                        ...page,
                        layers: [...newLayers, ...page.layers]
                    };
                }));
            } else {
                alert(
                    "Metin alanı bulunamadı veya tanınamadı.\n\n" +
                    "İpucu: Lütfen resmin iyi yüklendiğinden ve OCR Motorunun (OCR.Space) ayarlandığından emin olun."
                );
            }
        } catch (error) {
            console.error("[OtoSecme] OCR Hatası:", error);
            alert("Metin analizi sırasında bir hata oluştu. Konsolu kontrol edin.");
        } finally {
            setIsProcessing(false);
        }
    };

    return { triggerAI };
}
