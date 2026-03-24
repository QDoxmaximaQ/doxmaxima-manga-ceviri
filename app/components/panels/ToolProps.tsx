// app/components/panels/ToolProps.tsx
"use client";
import React from "react";
import { CircleX, Settings2, AlertCircle } from 'lucide-react';
import { ToolSettings, MangaPage } from "../hooks/useLayers"; // Merkezi tipleri kullanıyoruz

interface ToolPropsComponentProps {
    activeTool: string;
    toolSettings: ToolSettings;
    setToolSettings: React.Dispatch<React.SetStateAction<ToolSettings>>;
    // CANLI GÜNCELLEME İÇİN GEREKLİ YENİ PROPLAR
    pages: MangaPage[];
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>;
    activeLayerId: string | null;
    onClose?: () => void;
}

export default function Toolprops({ 
    activeTool, 
    toolSettings, 
    setToolSettings, 
    pages, 
    setPages, 
    activeLayerId, 
    onClose 
}: ToolPropsComponentProps) {

    /**
     * GÜNCELLEME MERKEZİ
     * Bu fonksiyon hem genel ayarları günceller hem de seçili metin katmanına anlık müdahale eder.
     */
    const updateSetting = (key: keyof ToolSettings, value: any) => {
        // 1. Genel ayarları güncelle (Yeni oluşturulacak kutular için)
        setToolSettings(prev => ({ ...prev, [key]: value }));

        // 2. EĞER METİN ARACI SEÇİLİYSE VE BİR KATMAN AKTİFSE ANLIK GÜNCELLE
        if (activeTool === 'metin' && activeLayerId) {
            setPages(prevPages => prevPages.map(page => ({
                ...page,
                layers: page.layers.map(layer => {
                    // Eğer aktif katman bu ise ve bir metin katmanıysa
                    if (layer.id === activeLayerId && layer.textConfig) {
                        // ToolSettings anahtarlarını textConfig anahtarlarına eşliyoruz
                        const configKeyMap: Record<string, string> = {
                            'textSize': 'fontSize',
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

    /**
     * --- METİN AYARLARI GÖRÜNÜMÜ ---
     */
    const renderTextSettings = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
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
            </div>

            {/* Metin Boyutu */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/60">Metin Boyutu</label>
                    <span className="text-[10px] font-mono bg-text/10 px-2 py-0.5 rounded text-text">{toolSettings.textSize}px</span>
                </div>
                <input
                    type="range" min="8" max="200"
                    value={toolSettings.textSize}
                    onChange={(e) => updateSetting('textSize', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-text"
                />
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
                        renderEmpty()}
            </div>
        </div>
    );
}