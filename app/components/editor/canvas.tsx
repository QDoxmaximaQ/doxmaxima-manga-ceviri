// app/components/editor/canvas.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useKaydirma } from "../hooks/tools/useKaydirma"; // Tuval kaydırma lojiği

// TİPLERİ MERKEZİ useLayers'DAN ALIYORUZ
import { MangaPage, ToolSettings } from "../hooks/useLayers";
import { calcDisplaySize } from "../../utils/displaySize";

// Araç Hook'ları ve Bileşenleri
import { useFirca } from "../hooks/tools/useFirca";
import { useSilgi } from "../hooks/tools/useSilgi";
import { useSecme } from "../hooks/tools/useSecme";
import { useMetin } from "../hooks/tools/useMetin";
import { useOtoSecme } from "../hooks/tools/useOtoSecme"; 
import { SecimKutusu } from "./overlays/SecimKutusu";
import { MetinKutusu } from "./overlays/MetinKutusu";

/**
 * TUVAL PROPS (CanvasProps)
 */
interface CanvasProps {
    activeTool: string;
    uploadedImage: string | null;
    pages: MangaPage[];
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>;
    activePageId: string | null;
    activeLayerId: string | null;
    setActiveLayerId: (id: string | null) => void;
    toolSettings: ToolSettings;
    setIsProcessing: (val: boolean) => void;
    isProcessing: boolean;
    pushHistory: () => void; // ← ekle
    setSystemMessage: (msg: { text: string; color: string }) => void;
}

export default function Canvas({
    activeTool,
    uploadedImage,
    pages,
    setPages,
    activePageId,
    activeLayerId,
    setActiveLayerId,
    toolSettings,
    setIsProcessing,
    isProcessing,
    pushHistory, // ← ekle
    setSystemMessage
}: CanvasProps) {
    // 1. SÜRÜKLEME (PAN) VE ZOOM MANTIĞI
    const { position, isDragging: isHandling, handleMouseDown: startHandling } = useKaydirma(activeTool);
    const [scale, setScale] = useState(0.5);
    const [canvasSize, setCanvasSize] = useState({ width: 840, height: 1200 });

    // 2. SİSTEM REF'LERİ VE DURUMLARI
    const tempCanvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isInside, setIsInside] = useState(false);
    const [showAutoSelectModal, setShowAutoSelectModal] = useState(false);

    // 3. ARAÇ HOOK ENTEGRASYONLARI
    const brush = useFirca(tempCanvasRef, activePageId, activeLayerId, pages, toolSettings, setPages, setActiveLayerId);
    const eraser = useSilgi(tempCanvasRef, activePageId, activeLayerId, pages, toolSettings, setPages);
    const selection = useSecme(activePageId, pages, setPages, setActiveLayerId);
    const textTool = useMetin(activePageId, pages, setPages, setActiveLayerId, toolSettings);
    // AI Aracı Hook'u
    const autoSelection = useOtoSecme(activePageId, pages, setPages, setIsProcessing, setSystemMessage);

    const activePage = pages.find(p => p.id === activePageId);

    // BU SATIRI EKLE ↓
    const visibleLayers = useMemo(() =>
        activePage ? [...activePage.layers].reverse().filter(l => l.dataURL && l.isVisible) : [],
        [activePage?.layers]
    );

    // BU SATIRI EKLE ↓
    const activeLayerName = useMemo(() =>
        activePage?.layers.find(l => l.id === activeLayerId)?.name,
        [activePage?.layers, activeLayerId]
    );

    const getLayerZIndex = useCallback((layerId: string) => {
        if (!activePage) return 1;
        const index = activePage.layers.findIndex(l => l.id === layerId);
        if (index === -1) return 1;
        // Layers array has 0=Top, N=Bottom. So zIndex should be max for 0.
        return (activePage.layers.length - index) * 5 + 10;
    }, [activePage]);


    // Zoom Hassasiyeti (Mouse Tekerleği)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        const zoomStep = e.deltaY * -0.001;
        setScale((prev) => Math.min(Math.max(prev + zoomStep, 0.2), 5.0));
    }, []);

    const handleMouseUp = useCallback(() => {
        if (activeTool === 'secme') {
            selection.endSelection();
        } else if (activeTool === 'metin') {
            textTool.endText();
        } else if (activeTool === 'fırca') {
            brush.endBrush();
        } else if (activeTool === 'remove') {
            eraser.endEraser();
        }
    }, [activeTool, brush, eraser, selection, textTool]);

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseUp]);

    // Resim Boyutuna Göre Tuval Ayarı
    useEffect(() => {
        if (!uploadedImage) {
            setCanvasSize({ width: 840, height: 1200 });
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled) return;
            const { displayW, displayH } = calcDisplaySize(img.naturalWidth, img.naturalHeight);
            setCanvasSize({ width: displayW, height: displayH });
        };
        img.src = uploadedImage;
        return () => { cancelled = true; };
    }, [uploadedImage]);

    // Koordinat Dönüştürücü (Ekranda tıklanan yeri tuval koordinatına çevirir)
    const getMouseCoords = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    };

    /**
     * KÖPRÜ FONKSİYONLARI
     */
    const handleUpdateSelection = (layerId: string, newSelection: { x: number, y: number, w: number, h: number }) => {
        // AI katmanları sabit kalır — koordinatlar değiştirilemez
        if (layerId.startsWith('layer-ai-')) return;

        setPages(prev => prev.map(p =>
            p.id === activePageId ? {
                ...p,
                layers: p.layers.map(l => {
                    if (l.id === layerId) {
                        // Eğer bu katman daha önce hatalı (okunamadı -> lines: []) olarak işaretlendiyse
                        // Kullanıcı bunu taşıdığında tekrar taranabilmesi için hatayı sıfırla (mor hale döndür)
                        const resetLines = l.lines && l.lines.length === 0 ? undefined : l.lines;
                        return { ...l, selection: newSelection, lines: resetLines };
                    }
                    return l;
                })
            } : p
        ));
    };

    const handleUpdateText = (id: string, config: any, content: string) => {
        setPages(prev => prev.map(p =>
            p.id === activePageId ? {
                ...p,
                layers: p.layers.map(l => l.id === id ? { ...l, text: content, textConfig: config } : l)
            } : p
        ));
    };

    // --- FARE OLAYLARI (Merkezi Araç Yönetimi) ---

    const handleMouseDown = (e: React.MouseEvent) => {
        const coords = getMouseCoords(e);

        if (activeTool === 'handle') {
            startHandling(e);
            return;
        }

        if (activeTool === 'otosecme') {
            setShowAutoSelectModal(true);
            return;
        }

        if (activePage) {
            if (activeTool === 'secme') {
                const hitSelection = activePage.layers.find(l => {
                    if (!l.selection || !l.isVisible) return false;
                    const { x, y, w, h } = l.selection;
                    return coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h;
                });
                if (hitSelection) {
                    setActiveLayerId(hitSelection.id);
                    return;
                }
            }

            if (activeTool === 'metin') {
                const hitText = activePage.layers.find(l => {
                    if (!l.textConfig || !l.isVisible) return false;
                    const { x, y, w, h } = l.textConfig;
                    return coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h;
                });
                if (hitText) {
                    setActiveLayerId(hitText.id);
                    return;
                }
            }
        }

        if (activeTool === 'secme') {
            pushHistory();
            selection.startSelection(coords);
        } else if (activeTool === 'metin') {
            pushHistory();
            textTool.startText(coords);
        } else if (activeTool === 'fırca') {
            pushHistory();
            brush.startBrush(coords);
        } else if (activeTool === 'remove') {
            pushHistory();
            eraser.startEraser(coords);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const coords = getMouseCoords(e);
        setMousePos(coords);

        if (activeTool === 'secme') {
            selection.moveSelection(coords);
        } else if (activeTool === 'metin') {
            textTool.moveText(coords);
        } else if (activeTool === 'fırca') {
            brush.moveBrush(coords);
        } else if (activeTool === 'remove') {
            eraser.moveEraser(coords);
        }
    };



    return (
        <section
            onWheel={handleWheel}
            className="flex flex-1 flex-col relative overflow-hidden bg-backga manga-grid"
            onMouseEnter={() => setIsInside(true)}
            onMouseLeave={() => setIsInside(false)}
        >
            <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                    width: `${canvasSize.width}px`,
                    height: `${canvasSize.height}px`,
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                    willChange: "transform"
                }}
                className={`absolute top-1/2 left-1/2 bg-[#f5eddc] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 origin-center overflow-hidden
                           ${activeTool === 'handle' ? (isHandling ? 'cursor-grabbing' : 'cursor-grab') :
                        activeTool === 'secme' || activeTool === 'metin' ? 'cursor-crosshair' :
                            activeTool === 'otosecme' ? (isProcessing ? 'cursor-wait' : 'cursor-pointer') : // AI aracı tıklandığında imleç değişir
                                (activeTool === 'fırca' || activeTool === 'remove') ? 'cursor-none' : 'cursor-default'}`}
            >
                {/* 1. VARSAYILAN RESİM */}
                {!activePage && (
                    <img src="/eklentiler/hinata.png" className="absolute bottom-0 w-full h-auto pointer-events-none opacity-40 object-contain" alt="Default View" />
                )}

                {/* 2. AKTİF KATMANLAR (Görsel Veriler) */}
                {visibleLayers.map((layer, i) => (
                    <img
                        key={layer.id}
                        src={layer.dataURL}
                        style={{ 
                            zIndex: getLayerZIndex(layer.id),
                            clipPath: layer.clipBox 
                                ? `inset(${layer.clipBox.y}px ${Math.max(0, canvasSize.width - (layer.clipBox.x + layer.clipBox.w))}px ${Math.max(0, canvasSize.height - (layer.clipBox.y + layer.clipBox.h))}px ${layer.clipBox.x}px)`
                                : undefined,
                            opacity: (layer.id === activeLayerId && eraser.isDrawingEraser) ? 0 : 1
                        }}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                ))}



                {/* 3. KAYITLI SEÇİM ALANLARI */}
                {(() => {
                    // Tüm seçim katmanlarının koordinatlarını topla (mavi alan üst üste binme kontrolü için)
                    const allSelections = activePage?.layers
                        .filter(l => l.selection && l.isVisible)
                        .map(l => ({ ...l.selection!, id: l.id })) || [];

                    return activePage?.layers.map(layer => (
                        layer.selection && layer.isVisible && (
                            <React.Fragment key={layer.id}>
                                <SecimKutusu
                                    layer={layer}
                                    isActive={activeLayerId === layer.id}
                                    canvasSize={canvasSize}
                                    scale={scale}
                                    onUpdate={handleUpdateSelection}
                                    allSelections={allSelections}
                                />
                                {/* YAPAY ZEKA İŞARETLEYİCİ - Merkeze Kırmızı Yuvarlak */}
                                {layer.id.startsWith('layer-ai-') && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layer.selection.x + layer.selection.w / 2}px`,
                                        top: `${layer.selection.y + layer.selection.h / 2}px`,
                                        width: '25px',
                                        height: '25px',
                                        backgroundColor: 'red',
                                        borderRadius: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'none',
                                        zIndex: getLayerZIndex(layer.id) + 1
                                    }} />
                                )}
                            </React.Fragment>
                        )
                    ));
                })()}

                {/* 4. METİN KUTULARI */}
                {activePage?.layers.map(layer => (
                    layer.textConfig && layer.isVisible && (
                        <MetinKutusu
                            key={layer.id}
                            layer={layer}
                            isActive={activeLayerId === layer.id}
                            scale={scale}
                            activeTool={activeTool}
                            onUpdate={handleUpdateText}
                            zIndex={getLayerZIndex(layer.id)}
                        />
                    )
                ))}

                {/* 5. ANLIK ÇİZİLEN ÇERÇEVELER (Önizlemeler) */}
                {selection.drawingSelection && (
                    <div style={{
                        position: 'absolute',
                        left: `${selection.drawingSelection.x}px`,
                        top: `${selection.drawingSelection.y}px`,
                        width: `${selection.drawingSelection.w}px`,
                        height: `${selection.drawingSelection.h}px`,
                        border: '2px dashed #00ffd5',
                        backgroundColor: 'rgba(0, 255, 213, 0.1)',
                        pointerEvents: 'none',
                        zIndex: 160
                    }} />
                )}
                {textTool.drawingText && (
                    <div style={{
                        position: 'absolute',
                        left: `${textTool.drawingText.x}px`,
                        top: `${textTool.drawingText.y}px`,
                        width: `${textTool.drawingText.w}px`,
                        height: `${textTool.drawingText.h}px`,
                        border: '1px dashed #00ffd5',
                        backgroundColor: 'rgba(0, 255, 213, 0.05)',
                        pointerEvents: 'none',
                        zIndex: 160
                    }} />
                )}

                {/* 6. DİNAMİK ARAÇ İMLECİ */}
                {(activeTool === 'fırca' || activeTool === 'remove') && isInside && (
                    <div
                        style={{
                            width: `${activeTool === 'fırca' ? toolSettings.brushSize : toolSettings.eraserSize}px`,
                            height: `${activeTool === 'fırca' ? toolSettings.brushSize : toolSettings.eraserSize}px`,
                            left: `${mousePos.x}px`, top: `${mousePos.y}px`,
                            backgroundColor: activeTool === 'fırca' ? toolSettings.brushColor : 'rgba(255,255,255,0.2)',
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 0 1px white, 0 0 5px rgba(0,0,0,0.5)',
                        }}
                        className="absolute rounded-full pointer-events-none z-110 opacity-50 border border-black/20"
                    />
                )}

                <canvas 
                    ref={tempCanvasRef} 
                    width={canvasSize.width} 
                    height={canvasSize.height} 
                    style={{
                        clipPath: (() => {
                            if (!activeLayerId || !activePage) return undefined;
                            const activeLayer = activePage.layers.find(l => l.id === activeLayerId);
                            // SADECE Silgi kullanırken kutu dışına çıkmasını engelle, Fırça özgür olmalıdır.
                            if (activeLayer?.clipBox && eraser.isDrawingEraser) {
                                return `inset(${activeLayer.clipBox.y}px ${Math.max(0, canvasSize.width - (activeLayer.clipBox.x + activeLayer.clipBox.w))}px ${Math.max(0, canvasSize.height - (activeLayer.clipBox.y + activeLayer.clipBox.h))}px ${activeLayer.clipBox.x}px)`;
                            }
                            return undefined;
                        })()
                    }}
                    className="absolute inset-0 w-full h-full z-[100] pointer-events-none mix-blend-normal" 
                />

                {/* YERELLEŞTİRİLMİŞ AI İŞLEM OVERLAY */}
                {isProcessing && (
                    <div className="absolute inset-0 z-[200] bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-auto select-none">
                        <div className="flex flex-col items-center gap-3 p-6 bg-[#1c1c27]/80 rounded-3xl border border-text/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-text/10 border-t-text rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-text rounded-full animate-ping"></div>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-text font-black text-xs uppercase tracking-[0.2em] mb-1">OCR SİSTEMİ ÇALIŞIYOR</p>
                                <p className="text-[9px] text-texts/40 uppercase font-bold">Resim Analiz Ediliyor...</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* BİLGİ PANELLERİ (Zoom ve Koordinat Bilgisi) */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 pointer-events-none text-white font-mono text-[10px]">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 shadow-2xl flex gap-2">
                    <span className="text-text font-bold uppercase tracking-widest">Zoom:</span> {(scale * 100).toFixed(0)}%
                </div>
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 shadow-2xl flex gap-2">
                    <span className="text-text font-bold uppercase tracking-widest">Pos:</span> X: {Math.round(mousePos.x)} Y: {Math.round(mousePos.y)}
                </div>
            </div>

            {/* ARAÇ VE KATMAN BİLGİSİ (Sağ Alt Panel) */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 pointer-events-none items-end text-white font-mono text-[10px]">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 shadow-2xl flex gap-2 w-fit">
                    <span className="text-text font-bold uppercase tracking-widest">Tool:</span> {activeTool.toUpperCase()}
                </div>
                {activeLayerId && (
                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 shadow-2xl flex gap-2 w-fit">
                        <span className="text-text font-bold uppercase tracking-widest">Layer:</span> {activeLayerName}
                    </div>
                )}
            </div>

            {/* OTO SECME MODALI */}
            {showAutoSelectModal && (
                <div className="absolute inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
                    <div className="bg-[#1c1c27] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-w-sm w-full mx-4">
                        <h3 className="text-text font-bold text-lg border-b border-white/10 pb-2">Oto Seçim İşlemi</h3>
                        <p className="text-sm text-texts/80">
                            OCR işleminin hangi sayfalara uygulanmasını istiyorsunuz?
                        </p>
                        <div className="flex gap-3 justify-end mt-4">
                            <button
                                onClick={() => {
                                    setShowAutoSelectModal(false);
                                }}
                                className="px-4 py-2 rounded-xl text-texts/70 hover:bg-white/5 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={() => {
                                    setShowAutoSelectModal(false);
                                    autoSelection.triggerAI('single');
                                }}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-text/50 text-white transition-all hover:bg-white/10"
                            >
                                Sadece Bu Sayfa
                            </button>
                            <button
                                onClick={() => {
                                    setShowAutoSelectModal(false);
                                    autoSelection.triggerAI('all');
                                }}
                                className="px-5 py-2 rounded-xl bg-text text-black font-bold border border-transparent shadow-[0_0_15px_rgba(0,255,213,0.3)] hover:scale-105 transition-all cursor-pointer"
                            >
                                Tüm Sayfalar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}