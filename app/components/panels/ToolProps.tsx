// app/components/panels/ToolProps.tsx
"use client";
import React from "react";
import { ToolSettings, MangaPage, Layer } from "../hooks/useLayers";
import { calcDisplaySize, getOriginalDimensions } from "../../utils/displaySize";
import { CircleX, Settings2, AlertCircle, Wand2 } from 'lucide-react';

/** Sayı Giriş Bileşeni - Basılı - İle Azalt, + İle Artır */
function NumericInput({ label, value, min = 1, max, step = 1, onChange }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (val: number) => void;
}) {
    const clamp = (v: number) => {
        let r = v;
        if (min !== undefined) r = Math.max(min, r);
        if (max !== undefined) r = Math.min(max, r);
        return r;
    };
    return (
        <div className="flex flex-col gap-1 min-w-0 w-full">
            {label && <label className="text-[9px] font-bold uppercase tracking-widest text-text/50">{label}</label>}
            <div className="flex items-stretch border border-white/10 rounded overflow-hidden w-full">
                <button
                    type="button"
                    onClick={() => onChange(clamp(value - step))}
                    className="px-2 text-text/60 hover:text-text hover:bg-white/10 transition-colors text-sm font-bold select-none shrink-0"
                >−</button>
                <input
                    type="number"
                    value={value}
                    min={min} max={max} step={step}
                    onChange={(e) => onChange(clamp(parseInt(e.target.value) || min || 1))}
                    className="w-0 flex-1 min-w-0 bg-white/5 text-center text-[10px] font-mono text-text outline-none py-1 px-1"
                />
                <button
                    type="button"
                    onClick={() => onChange(clamp(value + step))}
                    className="px-2 text-text/60 hover:text-text hover:bg-white/10 transition-colors text-sm font-bold select-none shrink-0"
                >+</button>
            </div>
        </div>
    );
}

interface ToolPropsComponentProps {
    activeTool: string;
    toolSettings: ToolSettings;
    setToolSettings: React.Dispatch<React.SetStateAction<ToolSettings>>;
    // CANLI GÜNCELLEME İÇİN GEREKLİ YENİ PROPLAR
    pages: MangaPage[];
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>;
    activeLayerId: string | null;
    activePageId: string | null;
    setIsProcessing: (val: boolean) => void;
    setSystemMessage: (msg: { text: string; color: string }) => void;
    onClose?: () => void;
}

export default function Toolprops({ 
    activeTool, 
    toolSettings, 
    setToolSettings, 
    pages, 
    setPages, 
    activeLayerId, 
    activePageId,
    setIsProcessing,
    setSystemMessage,
    onClose 
}: ToolPropsComponentProps) {

    /**
     * GÜNCELLEME MERKEZİ
     * Bu fonksiyon hem genel ayarları günceller hem de seçili metin katmanına anlık müdahale eder.
     */
    const updateSetting = (key: keyof ToolSettings, value: any) => {
        // 1. Genel ayarları güncelle (Yeni oluşturulacak kutular için)
        setToolSettings(prev => ({ ...prev, [key]: value }));

        // 2. Font ve renk ayarlarını localStorage'a kaydet (otoSecme.tsx ile senkronizasyon)
        if (key === 'textFont') localStorage.setItem('__textFont', value);
        if (key === 'textColor') localStorage.setItem('__textColor', value);

        // 2. EĞER METİN ARACI SEÇİLİYSE VE BİR KATMAN AKTİFSE ANLIK GÜNCELLE
        if (activeTool === 'metin' && activeLayerId) {
            setPages(prevPages => prevPages.map(page => ({
                ...page,
                layers: page.layers.map(layer => {
                    // Eğer aktif katman bu ise ve bir metin katmanıysa
                    if (layer.id === activeLayerId && layer.textConfig) {
                        // ToolSettings anahtarlarını textConfig anahtarlarına eşliyoruz
                        const configKeyMap: Record<string, string> = {
                            'textColor': 'color',
                            'textFont': 'fontFamily'
                        };

                        const configKey = configKeyMap[key];
                        if (configKey) {
                            return {
                                ...layer,
                                textConfig: {
                                    ...layer.textConfig,
                                    [configKey]: value
                                }
                            };
                        }
                    }
                    return layer;
                })
            })));
        }
    };

    // --- SEÇİM (MANUEL OCR) AYARLARI ---
    const activePage = pages.find(p => p.id === activePageId);
    const manualLayersCount = activePage?.layers.filter(l => l.selection && !l.lines).length || 0;

    const processManualSelections = async () => {
        if (!activePageId || !activePage) return;

        const manualLayers = activePage.layers.filter(l => l.selection && !l.lines);
        if (manualLayers.length === 0) {
            setSystemMessage({ text: "Sistem: İşlenecek alan yok", color: "text-orange-500" });
            return;
        }

        const engine = localStorage.getItem("ocrEngine") || "tesseract";
        setIsProcessing(true);
        setSystemMessage({ text: "Sistem: Seçili Alanlar İşleniyor...", color: "text-blue-400" });

        try {
            const origDimensions = await getOriginalDimensions(activePage.url!);

            const { displayW, displayH } = calcDisplaySize(origDimensions.w, origDimensions.h);

            const scaleX = displayW / origDimensions.w;
            const scaleY = displayH / origDimensions.h;

            let results: any[] = [];
            if (engine === "ocrspace") {
                const { recognizeWithOCRSpace } = await import("../../ocr/ocrspace");
                results = await recognizeWithOCRSpace(activePage.url!, localStorage.getItem("ocrspaceApiKey") || "");
            } else if (engine === "paddleocr") {
                const { recognizeWithPaddleOCR } = await import("../../ocr/paddleocr");
                results = await recognizeWithPaddleOCR(activePage.url!, localStorage.getItem("paddleOcrUrl") || "");
            } else if (engine === "easyocr") {
                const { recognizeWithEasyOCR } = await import("../../ocr/easyocr");
                results = await recognizeWithEasyOCR(activePage.url!, localStorage.getItem("easyOcrUrl") || "");
            }

            if (results && results.length > 0) {
                setSystemMessage({ text: "Sistem: Arkaplan İşleniyor...", color: "text-[#00ffd5]" });

                const targetBoxes: Array<{x: number, y: number, w: number, h: number}> = [];
                
                const updatedLayers = activePage.layers.flatMap(layer => {
                    if (!layer.selection || layer.lines) return [layer];

                    const lx = layer.selection.x;
                    const ly = layer.selection.y;
                    const lw = layer.selection.w;
                    const lh = layer.selection.h;

                    const intersectingResults = results.filter((res: any) => {
                        const rawX = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                        const rawY = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;
                        const rx = rawX * scaleX;
                        const ry = rawY * scaleY;
                        const rw = res.width * scaleX;
                        const rh = res.height * scaleY;

                        return !(rx > lx + lw || rx + rw < lx || ry > ly + lh || ry + rh < ly);
                    });

                    if (intersectingResults.length > 0) {
                        let combinedText = "";
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                        intersectingResults.forEach((res: any) => {
                            combinedText += (combinedText ? " " : "") + res.text;
                            
                            const rawX = res.bbox ? res.bbox.x0 : res.centerX - res.width / 2;
                            const rawY = res.bbox ? res.bbox.y0 : res.centerY - res.height / 2;
                            const rx = rawX * scaleX;
                            const ry = rawY * scaleY;
                            const rw = res.width * scaleX;
                            const rh = res.height * scaleY;

                            minX = Math.min(minX, rx);
                            minY = Math.min(minY, ry);
                            maxX = Math.max(maxX, rx + rw);
                            maxY = Math.max(maxY, ry + rh);
                        });

                        const targetBox = {
                            x: minX - 2,
                            y: minY - 2,
                            w: (maxX - minX) + 4,
                            h: (maxY - minY) + 4
                        };
                        targetBoxes.push(targetBox);

                        const textLayer: Layer = {
                            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            name: layer.name.replace("Secili alan", "Metin"),
                            isVisible: true,
                            text: combinedText,
                            textConfig: {
                                x: minX - 5,
                                y: minY - 5,
                                w: (maxX - minX) + 10,
                                h: (maxY - minY) + 10,
                                fontSize: 16,
                                color: toolSettings.textColor,
                                fontFamily: toolSettings.textFont
                            }
                        };
                        
                        const bgLayer: Layer = {
                            id: `layer-bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            name: layer.name.replace("Secili alan", "Arkaplan"),
                            isVisible: true,
                            clipBox: targetBox
                        };

                        return [textLayer, bgLayer];
                    } else {
                        // Kesişim yoksa katmanı silmek üzere boş bırak
                        return []; // aşağıda filtreleyeceğiz
                    }
                }).filter(Boolean) as Layer[];

                // Arkaplan Inpainting İşlemi
                let cleanUrl = activePage.url!;
                try {
                    if (targetBoxes.length > 0) {
                        const bgEngine = localStorage.getItem("bgEngine") || "lama";
                        if (bgEngine === "sd") {
                            const { processWithStableDiffusion } = await import("../../arkaplan/stable-diffusion");
                            cleanUrl = await processWithStableDiffusion(cleanUrl, [], targetBoxes, scaleX, scaleY);
                        } else {
                            const { processWithLama } = await import("../../arkaplan/lama");
                            cleanUrl = await processWithLama(cleanUrl, [], targetBoxes, scaleX, scaleY);
                        }
                    }
                } catch (err: any) {
                    console.error("[Secme] Arkaplan inpainting hatası:", err);
                }

                setPages(prev => prev.map(page => {
                    if (page.id !== activePageId) return page;

                    const finalLayers = updatedLayers.map(l => 
                        l.id.startsWith('layer-bg-') && !l.dataURL 
                            ? { ...l, dataURL: cleanUrl } 
                            : l
                    );

                    return { 
                        ...page, 
                        // url: cleanUrl YAPMIYORUZ, orijinal resim kalıyor
                        layers: finalLayers.filter(l => !l.selection) 
                    };
                }));

                setSystemMessage({ text: "Sistem: İşlem Başarılı", color: "text-[#00ffd5]" });
            } else {
                setSystemMessage({ text: "Hata: Hiç Metin Bulunamadı", color: "text-orange-500" });
            }
        } catch (error: any) {
            console.error("[Secme] OCR Hatası:", error);
            setSystemMessage({ text: "Hata: İşlem Başarısız", color: "text-red-500 font-bold" });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" }), 4000);
        }
    };

    // Aktif katman boyut güncelleyici (secme)
    const activeSelectionLayer = activePage?.layers.find(l => l.id === activeLayerId && l.selection);
    const updateSelectionSize = (key: 'w' | 'h', val: number) => {
        if (!activeLayerId || !activeSelectionLayer?.selection) return;
        setPages(prev => prev.map(p => p.id !== activePageId ? p : {
            ...p,
            layers: p.layers.map(l => l.id === activeLayerId ? { ...l, selection: { ...l.selection!, [key]: Math.max(10, val) } } : l)
        }));
    };

    // AI katmanı mı kontrolü
    const isActiveAILayer = activeLayerId?.startsWith('layer-ai-') || false;

    const renderSelectionSettings = () => (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
            {/* Boyut Ayarlaması — sadece manuel seçimler için */}
            {activeSelectionLayer?.selection && !isActiveAILayer && (
                <div className="flex gap-2">
                    <div className="flex-1">
                        <NumericInput
                            label="Width"
                            value={Math.round(activeSelectionLayer.selection.w)}
                            min={10}
                            onChange={(v) => updateSelectionSize('w', v)}
                        />
                    </div>
                    <div className="flex-1">
                        <NumericInput
                            label="Height"
                            value={Math.round(activeSelectionLayer.selection.h)}
                            min={10}
                            onChange={(v) => updateSelectionSize('h', v)}
                        />
                    </div>
                </div>
            )}
            {/* AI katmanı bilgilendirmesi */}
            {activeSelectionLayer?.selection && isActiveAILayer && (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded">
                    <Wand2 size={12} className="text-blue-400 shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300/80">OCR Alanı — Sabit Konum</span>
                </div>
            )}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 rounded">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text/80">Bekleyen:</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded text-white bg-black/20">{manualLayersCount} Seçim</span>
                </div>
                <button 
                    disabled={manualLayersCount === 0}
                    onClick={processManualSelections}
                    className="w-full bg-text/10 hover:bg-text/20 disabled:opacity-50 disabled:cursor-not-allowed border border-text/20 text-text text-[9px] font-bold uppercase tracking-widest py-2 rounded flex justify-center items-center gap-2 transition-all active:scale-95"
                >
                    <Wand2 size={12} /> Alanları Seç ve Temizle
                </button>
            </div>
        </div>
    );

    // Aktif katman boyut güncelleyici (metin)
    const activeTextLayer = activePage?.layers.find(l => l.id === activeLayerId && l.textConfig);
    const updateTextSize = (key: 'w' | 'h', val: number) => {
        if (!activeLayerId || !activeTextLayer?.textConfig) return;
        setPages(prev => prev.map(p => p.id !== activePageId ? p : {
            ...p,
            layers: p.layers.map(l => l.id === activeLayerId && l.textConfig ? { ...l, textConfig: { ...l.textConfig, [key]: Math.max(10, val) } } : l)
        }));
    };

    /**
     * --- METİN AYARLARI GÖRÜNÜMÜ ---
     */
    const renderTextSettings = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Kutu Boyutu (Width / Height) */}
            {activeTextLayer?.textConfig && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Kutu Boyutu</label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <NumericInput
                                label="Width"
                                value={Math.round(activeTextLayer.textConfig.w)}
                                min={10}
                                onChange={(v) => updateTextSize('w', v)}
                            />
                        </div>
                        <div className="flex-1">
                            <NumericInput
                                label="Height"
                                value={Math.round(activeTextLayer.textConfig.h)}
                                min={10}
                                onChange={(v) => updateTextSize('h', v)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Yazı Tipi Seçimi */}
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Yazı Tipi</label>
                <select 
                    value={toolSettings.textFont}
                    onChange={(e) => updateSetting('textFont', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[10px] font-bold text-text outline-none focus:border-text/50 transition-colors"
                >
                    <option value="Arial" className="bg-backg">Arial (Standart)</option>
                    <option value="Verdana" className="bg-backg">Verdana</option>
                    <option value="Tahoma" className="bg-backg">Tahoma</option>
                    <option value="Georgia" className="bg-backg">Georgia</option>
                    <option value="Courier New" className="bg-backg">Courier New</option>
                    <option value="Comic Sans MS" className="bg-backg">Manga Style (Comic Sans)</option>
                </select>
                <div className="flex gap-2">
                    <button 
                        onClick={() => {
                            setPages(prevPages => prevPages.map(p => {
                                if (p.id !== activePageId) return p;
                                return {
                                    ...p,
                                    layers: p.layers.map(l => l.textConfig ? { ...l, textConfig: { ...l.textConfig, fontFamily: toolSettings.textFont } } : l)
                                };
                            }));
                            setSystemMessage({ text: "Sistem: Font sayfaya uygulandı", color: "text-[#00ffd5]" });
                        }}
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-text/80 hover:text-text text-[8px] font-bold uppercase tracking-wider py-1.5 px-1 rounded transition-colors"
                        title="Seçili fontu bu sayfadaki tüm yazılara uygular"
                    >
                        Sayfaya Uygula
                    </button>
                    <button 
                        onClick={() => {
                            setPages(prevPages => prevPages.map(p => ({
                                ...p,
                                layers: p.layers.map(l => l.textConfig ? { ...l, textConfig: { ...l.textConfig, fontFamily: toolSettings.textFont } } : l)
                            })));
                            setSystemMessage({ text: "Sistem: Font tüm sayfalara uygulandı", color: "text-[#00ffd5]" });
                        }}
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-text/80 hover:text-text text-[8px] font-bold uppercase tracking-wider py-1.5 px-1 rounded transition-colors"
                        title="Seçili fontu projedeki BÜTÜN sayfalara uygular"
                    >
                        Tümüne Uygula
                    </button>
                </div>
            </div>

            {/* Metin Rengi */}
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Metin Rengi</label>
                <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#000000', '#ff0000', '#00ffd5', '#ff00ff', '#ffff00'].map(color => (
                        <button
                            key={color}
                            onClick={() => updateSetting('textColor', color)}
                            style={{ backgroundColor: color }}
                            className={`w-6 h-6 rounded border-2 transition-transform active:scale-90 ${toolSettings.textColor === color ? 'border-text scale-110 shadow-[0_0_10px_rgba(0,255,213,0.3)]' : 'border-white/10'}`}
                        />
                    ))}
                    <input
                        type="color"
                        value={toolSettings.textColor}
                        onChange={(e) => updateSetting('textColor', e.target.value)}
                        className="w-6 h-6 bg-transparent border-none cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );

    // Fırça Ayarları Görünümü
    const renderBrushSettings = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Renk</label>
                <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#000000', '#ff0000', '#00ffd5', '#ff00ff', '#ffff00'].map(color => (
                        <button
                            key={color}
                            onClick={() => updateSetting('brushColor', color)}
                            style={{ backgroundColor: color }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${toolSettings.brushColor === color ? 'border-text scale-110 shadow-[0_0_10px_rgba(0,255,213,0.5)]' : 'border-white/10'}`}
                        />
                    ))}
                    <input type="color" value={toolSettings.brushColor} onChange={(e) => updateSetting('brushColor', e.target.value)} className="w-6 h-6 bg-transparent" />
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Fırça Boyutu</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text ">{toolSettings.brushSize}px</span>
                </div>
                <input
                    type="range" min="1" max="100"
                    value={toolSettings.brushSize}
                    onChange={(e) => updateSetting('brushSize', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Opaklık</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">%{Math.round(toolSettings.brushOpacity * 100)}</span>
                </div>
                <input
                    type="range" min="0.01" max="1.0" step="0.01"
                    value={toolSettings.brushOpacity}
                    onChange={(e) => updateSetting('brushOpacity', parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Keskinlik</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">%{toolSettings.brushHardness}</span>
                </div>
                <input
                    type="range" min="0" max="100"
                    value={toolSettings.brushHardness}
                    onChange={(e) => updateSetting('brushHardness', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
        </div>
    );

    // Silgi Ayarları Görünümü
    const renderEraserSettings = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Silgi Boyutu</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">{toolSettings.eraserSize}px</span>
                </div>
                <input
                    type="range" min="1" max="200"
                    value={toolSettings.eraserSize}
                    onChange={(e) => updateSetting('eraserSize', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Silme İzi Opaklığı</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">%{Math.round(toolSettings.eraserOpacity * 100)}</span>
                </div>
                <input
                    type="range" min="0.01" max="1.0" step="0.01"
                    value={toolSettings.eraserOpacity}
                    onChange={(e) => updateSetting('eraserOpacity', parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Silgi Keskinliği</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">%{toolSettings.eraserHardness}</span>
                </div>
                <input
                    type="range" min="0" max="100"
                    value={toolSettings.eraserHardness}
                    onChange={(e) => updateSetting('eraserHardness', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
            </div>
        </div>
    );

    const renderEmpty = () => (
        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 text-center px-4">
            <AlertCircle size={24} />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-relaxed">
                Bu Toolun Özellikleri yoktur
            </p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-backg overflow-hidden">
            <header className="flex h-9 shrink-0 items-center justify-between px-4 bg-white/2 border-b border-white/10">
                <div className="flex items-center gap-2 text-text">
                    <Settings2 size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Özellikler</span>
                </div>
                <button onClick={onClose} className="text-texts/30 hover:text-red-500 transition-colors p-1">
                    <CircleX size={14} />
                </button>
            </header>

            <div className="flex-1 m-2 p-4 bg-backg rounded overflow-y-auto custom-scrollbar shadow-inner">
                {activeTool === 'fırca' ? renderBrushSettings() :
                    activeTool === 'remove' ? renderEraserSettings() :
                    activeTool === 'metin' ? renderTextSettings() : 
                    activeTool === 'secme' ? renderSelectionSettings() : 
                        renderEmpty()}
            </div>
        </div>
    );
}