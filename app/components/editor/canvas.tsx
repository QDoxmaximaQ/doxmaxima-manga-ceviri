// app/components/editor/canvas.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useHandleLogic } from "../Tools/kaydırma"; // Tuval kaydırma lojiği

// TİPLERİ MERKEZİ useLayers'DAN ALIYORUZ
import { MangaPage, ToolSettings } from "../hooks/useLayers";

// Araç Hook'ları ve Bileşenleri
import { useBrush } from "../Tools/Fırca";
import { useEraser } from "../Tools/silgi";
import { SelectionBox, useSelection } from "../Tools/secme";
import { TextBox, useText } from "../Tools/metin";
import { useAutoSelection } from "../Tools/otoSecme"; // AI Hook'u eklendi

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
    pushHistory: () => void; // ← ekle
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
    pushHistory // ← ekle
}: CanvasProps) {
    // 1. SÜRÜKLEME (PAN) VE ZOOM MANTIĞI
    const { position, isDragging: isHandling, handleMouseDown: startHandling } = useHandleLogic(activeTool);
    const [scale, setScale] = useState(0.5);
    const [canvasSize, setCanvasSize] = useState({ width: 840, height: 1200 });

    // 2. SİSTEM REF'LERİ VE DURUMLARI
    const tempCanvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isInside, setIsInside] = useState(false);

    // 3. ARAÇ HOOK ENTEGRASYONLARI
    const brush = useBrush(tempCanvasRef, activePageId, activeLayerId, pages, toolSettings, setPages, setActiveLayerId);
    const eraser = useEraser(tempCanvasRef, activePageId, activeLayerId, pages, toolSettings, setPages);
    const selection = useSelection(activePageId, pages, setPages, setActiveLayerId);
    const textTool = useText(activePageId, pages, setPages, setActiveLayerId, toolSettings);
    // AI Aracı Hook'u
    const autoSelection = useAutoSelection(activePageId, pages, setPages, setIsProcessing);

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
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const baseW = 840;
            const baseH = 1200;
            if (h >= w) {
                setCanvasSize({ width: Math.round(baseH * (w / h)), height: baseH });
            } else {
                setCanvasSize({ width: baseW, height: Math.round(baseW * (h / w)) });
            }
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
        setPages(prev => prev.map(p =>
            p.id === activePageId ? {
                ...p,
                layers: p.layers.map(l => l.id === layerId ? { ...l, selection: newSelection } : l)
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
            autoSelection.triggerAI();
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
                            activeTool === 'otosecme' ? 'cursor-wait' : // AI aracı için bekleme imleci
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
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ zIndex: i + 1 }}
                    />
                ))}



                {/* 3. KAYITLI SEÇİM ALANLARI */}
                {activePage?.layers.map(layer => (
                    layer.selection && layer.isVisible && (
                        <SelectionBox
                            key={layer.id}
                            layer={layer}
                            isActive={activeLayerId === layer.id}
                            canvasSize={canvasSize}
                            scale={scale}
                            onUpdate={handleUpdateSelection}
                        />
                    )
                ))}

                {/* 4. METİN KUTULARI */}
                {activePage?.layers.map(layer => (
                    layer.textConfig && layer.isVisible && (
                        <TextBox
                            key={layer.id}
                            layer={layer}
                            isActive={activeLayerId === layer.id}
                            scale={scale}
                            activeTool={activeTool}
                            onUpdate={handleUpdateText}
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

                <canvas ref={tempCanvasRef} width={canvasSize.width} height={canvasSize.height} className="absolute inset-0 w-full h-full z-100 pointer-events-none" />
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
        </section>
    );
}