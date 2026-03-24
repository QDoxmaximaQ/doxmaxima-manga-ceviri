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

export function useAutoSelection(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setIsProcessing: (val: boolean) => void
) {
    const triggerAI = async () => {
        if (!activePageId) {
            alert("Lütfen önce bir resim seçin!");
            return;
        }

        const activePage = pages.find(p => p.id === activePageId);
        if (!activePage || !activePage.url) return;

        const engine = localStorage.getItem("ocrEngine") || "tesseract";
        setIsProcessing(true);

        try {
            let results: any[] = [];
            
            if (engine === "tesseract") {
                const { recognizeWithTesseract } = await import("../../../app/ocr/tesseract");
                results = await recognizeWithTesseract(activePage.url);
            } else if (engine === "gemini") {
                const { recognizeWithGemini } = await import("../../../app/ocr/gemini");
                results = await recognizeWithGemini(activePage.url);
            } else if (engine === "cloudvision") {
                const { recognizeWithCloudVision } = await import("../../../app/ocr/cloudVision");
                results = await recognizeWithCloudVision(activePage.url);
            }

            if (results && results.length > 0) {
                // Seçimleri (ve bulunan metinleri) yeni katmanlar olarak ekleyelim
                setPages(prev => prev.map(page => {
                    if (page.id !== activePageId) return page;

                    const newLayers = results.map((res: any, idx: number) => {
                        const x = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                        const y = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;

                        return {
                            id: `layer-ai-${Date.now()}-${idx}`,
                            name: `AI Seçim ${idx + 1}`,
                            isVisible: true,
                            selection: {
                                x: x,
                                y: y,
                                w: res.width,
                                h: res.height,
                            },
                            text: res.text, // Gelecekte çeviride vb. kullanmak için ekliyoruz
                        };
                    });

                    return {
                        ...page,
                        // Yeni seçim katmanlarını en üste yerleştiriyoruz
                        layers: [...newLayers, ...page.layers]
                    };
                }));
            } else {
                alert("Metin alanı bulunamadı veya tanınamadı.");
            }
        } catch (error) {
            console.error("OCR Hatası:", error);
            alert("Metin analizi sırasında bir hata oluştu.");
        } finally {
            setIsProcessing(false);
        }
    };

    return { triggerAI };
}