// app/components/hooks/tools/useOtoSecme.ts
import { MangaPage, Layer } from "../useLayers";
import { calcDisplaySize, getOriginalDimensions } from "../../../utils/displaySize";

export function useOtoSecme(
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

                const origDimensions = await getOriginalDimensions(page.url);

                const { displayW, displayH } = calcDisplaySize(origDimensions.w, origDimensions.h);
                const scaleX = displayW / origDimensions.w;
                const scaleY = displayH / origDimensions.h;

                let results: any[] = [];

                if (engine === "ocrspace") {
                    const { recognizeWithOCRSpace } = await import("../../../ocr/ocrspace");
                    const apiKey = localStorage.getItem("ocrspaceApiKey");
                    if (!apiKey) {
                        setSystemMessage({ text: "Hata: API Key Boş", color: "text-red-500" });
                        setIsProcessing(false);
                        return;
                    }
                    results = await recognizeWithOCRSpace(page.url, apiKey);
                } else if (engine === "paddleocr") {
                    const { recognizeWithPaddleOCR } = await import("../../../ocr/paddleocr");
                    const endpointUrl = localStorage.getItem("paddleOcrUrl") || "";
                    results = await recognizeWithPaddleOCR(page.url, endpointUrl);
                } else if (engine === "easyocr") {
                    const { recognizeWithEasyOCR } = await import("../../../ocr/easyocr");
                    const endpointUrl = localStorage.getItem("easyOcrUrl") || "";
                    results = await recognizeWithEasyOCR(page.url, endpointUrl);
                }

                if (results && results.length > 0) {
                    if (mode === 'all') {
                        setSystemMessage({ text: `Sistem: Arkaplan İşleniyor ${i + 1}/${targetPages.length}`, color: "text-[#00ffd5]" });
                    } else {
                        setSystemMessage({ text: `Sistem: Arkaplan İşleniyor...`, color: "text-[#00ffd5]" });
                    }

                    const targetBoxes: Array<{x: number, y: number, w: number, h: number}> = [];
                    const newLayerPairs: Layer[] = [];
                    const selectionCount = page.layers.filter(l => l.text !== undefined).length || 0;
                    
                    const savedFont = localStorage.getItem("__textFont") || "Comic Sans MS";
                    const savedColor = localStorage.getItem("__textColor") || "#000000";

                    results.forEach((res: any, idx: number) => {
                        const rawX = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                        const rawY = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;
                        const x = rawX * scaleX;
                        const y = rawY * scaleY;
                        const w = res.width * scaleX;
                        const h = res.height * scaleY;

                        const targetBox = { x: x - 2, y: y - 2, w: w + 4, h: h + 4 };
                        targetBoxes.push(targetBox);

                        const textLayer: Layer = {
                            id: `text-${Date.now()}-${idx}`,
                            name: `Metin ${selectionCount + idx + 1}`,
                            isVisible: true,
                            text: res.text,
                            textConfig: { x: x - 5, y: y - 5, w: w + 10, h: h + 10, fontSize: 16, color: savedColor, fontFamily: savedFont }
                        };
                        
                        const bgLayer: Layer = {
                            id: `layer-bg-${Date.now()}-${idx}`,
                            name: `Arkaplan ${selectionCount + idx + 1}`,
                            isVisible: true,
                            clipBox: targetBox
                        };

                        newLayerPairs.unshift(textLayer, bgLayer);
                    });

                    const bgEngine = localStorage.getItem("bgEngine") || "lama";
                    let cleanUrl = page.url;
                    try {
                        if (bgEngine === "sd") {
                            const { processWithStableDiffusion } = await import("../../../arkaplan/stable-diffusion");
                            cleanUrl = await processWithStableDiffusion(page.url, [], targetBoxes, scaleX, scaleY);
                        } else {
                            const { processWithLama } = await import("../../../arkaplan/lama");
                            cleanUrl = await processWithLama(page.url, [], targetBoxes, scaleX, scaleY);
                        }
                    } catch (err: any) {
                        console.error("[useOtoSecme] Arkaplan hatası:", err);
                        setSystemMessage({ text: "Uyarı: Arkaplan Temizleme Başarısız, Sadece Metinler Eklendi", color: "text-orange-500 font-bold text-xs" });
                    }

                    setPages(prev => prev.map(p => {
                        if (p.id !== page.id) return p;

                        const mappedNewLayers = newLayerPairs.map(l => 
                            l.id.startsWith('layer-bg-') ? { ...l, dataURL: cleanUrl } : l
                        );

                        return {
                            ...p,
                            layers: [...mappedNewLayers, ...p.layers.filter(l => !l.selection)]
                        };
                    }));
                }
            }

            setSystemMessage({ text: "Sistem: İşlem Başarılı", color: "text-[#00ffd5]" });
            setTimeout(() => setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" }), 4000);

        } catch (error: any) {
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
