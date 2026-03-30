// app/components/Tools/otoSecme.tsx
"use client";

import React from "react";
import { MangaPage, Layer } from "../hooks/useLayers";
import { Wand2 } from "lucide-react";
import { calcDisplaySize, getOriginalDimensions } from "../../utils/displaySize";
import { processWithLama } from "../../arkaplan/lama";

export default function Otosecme({ isActive, isProcessing, onClick }: any) {
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
                <Wand2 size={18} className={isProcessing ? "animate-spin" : ""} />
            </button>
        </section>
    );
}


export function useAutoSelection(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setIsProcessing: (val: boolean) => void,
    setSystemMessage: (msg: { text: string; color: string }) => void
) {
    const triggerAI = async (mode: 'single' | 'all' = 'single') => {
        const targetPages = mode === 'single'
            ? pages.filter(p => p.id === activePageId)
            : pages;

        if (targetPages.length === 0) {
            setSystemMessage({ text: "Hata: İşlenecek sayfa bulunamadı", color: "text-red-500" });
            return;
        }

        const engine = localStorage.getItem("ocrEngine") || "tesseract";
        setIsProcessing(true);
        setSystemMessage({ text: `Sistem: ${targetPages.length} sayfa işleniyor...`, color: "text-blue-400" });

        try {
            for (let i = 0; i < targetPages.length; i++) {
                const page = targetPages[i];
                if (mode === 'all') {
                    setSystemMessage({ text: `Sistem: OCR İşleniyor ${i + 1}/${targetPages.length}`, color: "text-blue-400" });
                } else {
                    setSystemMessage({ text: `Sistem: OCR İşleniyor...`, color: "text-blue-400" });
                }
                if (!page.url) continue;

                // --- 1. ORİJİNAL RESİM BOYUTLARINI AL ---
                const origDimensions = await getOriginalDimensions(page.url);

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
                        setSystemMessage({ text: "Hata: API Key Boş", color: "text-red-500" });
                        setIsProcessing(false);
                        return;
                    }
                    results = await recognizeWithOCRSpace(page.url, apiKey);
                } else if (engine === "paddleocr") {
                    const { recognizeWithPaddleOCR } = await import("../../ocr/paddleocr");
                    const endpointUrl = localStorage.getItem("paddleOcrUrl") || "";
                    results = await recognizeWithPaddleOCR(page.url, endpointUrl);
                } else if (engine === "easyocr") {
                    const { recognizeWithEasyOCR } = await import("../../ocr/easyocr");
                    const endpointUrl = localStorage.getItem("easyOcrUrl") || "";
                    results = await recognizeWithEasyOCR(page.url, endpointUrl);
                }

                console.log(`[OtoSecme] OCR ham sonuç sayısı: ${results.length}`);

                if (results && results.length > 0) {
                    if (mode === 'all') {
                        setSystemMessage({ text: `Sistem: Arkaplan İşleniyor ${i + 1}/${targetPages.length}`, color: "text-[#00ffd5]" });
                    } else {
                        setSystemMessage({ text: `Sistem: Arkaplan İşleniyor...`, color: "text-[#00ffd5]" });
                    }

                    // --- 3. TARGET BOXES HESAPLAMA VE INPAINTING ---
                    const targetBoxes: Array<{x: number, y: number, w: number, h: number}> = [];
                    const newLayerPairs: Layer[] = [];
                    const selectionCount = page.layers.filter(l => l.text !== undefined).length || 0;
                    // Kullanıcı ayarlarından font ve renk al (metin.tsx ile senkron)
                    const savedFont = localStorage.getItem("__textFont") || "Comic Sans MS";
                    const savedColor = localStorage.getItem("__textColor") || "#000000";

                    results.forEach((res: any, idx: number) => {
                        const rawX = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                        const rawY = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;
                        const x = rawX * scaleX;
                        const y = rawY * scaleY;
                        const w = res.width * scaleX;
                        const h = res.height * scaleY;

                        // Lama inpainting için hedef kutuyu 2px genişlet (eski mor kutu hesabı gibi)
                        const targetBox = {
                            x: x - 2,
                            y: y - 2,
                            w: w + 4,
                            h: h + 4
                        };
                        targetBoxes.push(targetBox);

                        // Metin kutusu OCR kutusuna göre 5px her yöne genişletildi
                        const textLayer: Layer = {
                            id: `text-${Date.now()}-${idx}`,
                            name: `Metin ${selectionCount + idx + 1}`,
                            isVisible: true,
                            text: res.text,
                            textConfig: { 
                                x: x - 5, 
                                y: y - 5, 
                                w: w + 10, 
                                h: h + 10, 
                                fontSize: 16, 
                                color: savedColor, 
                                fontFamily: savedFont 
                            }
                        };
                        
                        const bgLayer: Layer = {
                            id: `layer-bg-${Date.now()}-${idx}`,
                            name: `Arkaplan ${selectionCount + idx + 1}`,
                            isVisible: true,
                            clipBox: targetBox
                        };

                        // Use unshift to place the higher-indexed (newer) pairs at the beginning
                        // Example: 1st iteration: [text1, bg1]
                        // 2nd iteration: [text2, bg2, text1, bg1]
                        // This makes 1 stack at the bottom and 3 stack at the top of the layer list! 
                        newLayerPairs.unshift(textLayer, bgLayer);
                    });

                    let cleanUrl = page.url;
                    try {
                        cleanUrl = await processWithLama(page.url, [], targetBoxes, scaleX, scaleY);
                    } catch (err: any) {
                        console.error("[OtoSecme] Lama hatası:", err);
                        // Kullanıcıya alt panalde hatanın olduğunu fakat metinlerin ekleneceğini belirten bilgi ver.
                        setSystemMessage({ text: "Uyarı: Arkaplan Temizleme Başarısız, Sadece Metinler Eklendi", color: "text-orange-500 font-bold text-xs" });
                        // 3 saniye sonra normale veya başarıya döndürme (bu isteğe bağlı, dışarıda setTimeout var zaten)
                    }

                    setPages(prev => prev.map(p => {
                        if (p.id !== page.id) return p;

                        const mappedNewLayers = newLayerPairs.map(l => 
                            l.id.startsWith('layer-bg-') ? { ...l, dataURL: cleanUrl } : l
                        );

                        return {
                            ...p,
                            // Orijinal arkaplan etkilenmeden üzerine parça eklenecek, url değiştirilmiyor
                            layers: [
                                ...mappedNewLayers, 
                                ...p.layers.filter(l => !l.selection) // Geriye kalmış varsa mavi kutuları da temizle
                            ]
                        };
                    }));
                }
            }

            setSystemMessage({ text: "Sistem: İşlem Başarılı", color: "text-[#00ffd5]" });
            setTimeout(() => setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" }), 4000);

        } catch (error: any) {
            console.error("[OtoSecme] OCR Hatası:", error);
            const msg = (error.message || "").toLowerCase();

            if (msg.includes("hf_not_running")) {
                setSystemMessage({ text: "Hata: Hugging Face Reponuz Kapalı", color: "text-red-500 font-bold" });
            } else if (msg.includes("huggingface") || msg.includes("fetch failed") || msg.includes("503") || msg.includes("504") || msg.includes("network") || msg.includes("space")) {
                setSystemMessage({ text: "Hata: Hugging Face Reponuza Ulaşılamıyor", color: "text-red-500 font-bold text-xs" });
            } else {
                setSystemMessage({ text: "Hata: Sunucuya Bağlanılamadı", color: "text-red-500 font-bold" });
            }
            setTimeout(() => setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" }), 8000);
        } finally {
            setIsProcessing(false);
        }
    };

    return { triggerAI };
}
