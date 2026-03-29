// app/components/Tools/secme.tsx
"use client";

import { PiCursorFill } from "react-icons/pi";
import { Move } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
// Tipleri merkezi hook dosyasından çekiyoruz
import { MangaPage, Layer } from "../hooks/useLayers"; 

// --- Araç Çubuğu Butonu (Sidebar) ---
interface SecmeProps {
    isActive?: boolean;
    isProcessing?: boolean;
    onClick?: () => void;
}

export default function Secme({ isActive, onClick }: SecmeProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Seçme Aracı (M)"
            >
                <PiCursorFill size={18} />
            </button>
        </section>
    );
}

/**
 * --- SEÇME HOOK'U ---
 * Tuval üzerinde yeni bir seçim alanı oluşturma lojiğini yönetir.
 * @param setActiveLayerId: Yeni katman eklendiğinde odağı oraya kaydırmak için kullanılır.
 */
export function useSelection(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setActiveLayerId: (id: string | null) => void // Otomatik seçim için gerekli
) {
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [currentSelection, setCurrentSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // Yeni seçim başlatma
    const startSelection = (coords: { x: number, y: number }) => {
        setSelectionStart(coords);
    };

    // Fare hareket ederken kutuyu güncelleme
    const moveSelection = (coords: { x: number, y: number }) => {
        if (!selectionStart) return;
        
        setCurrentSelection({
            x: Math.min(coords.x, selectionStart.x),
            y: Math.min(coords.y, selectionStart.y),
            w: Math.abs(coords.x - selectionStart.x),
            h: Math.abs(coords.y - selectionStart.y)
        });
    };

    // Seçim işlemini bitirip katman olarak kaydetme
    const endSelection = () => {
        if (currentSelection && currentSelection.w > 5 && currentSelection.h > 5 && activePageId) {
            const activePage = pages.find(p => p.id === activePageId);
            const selectionCount = activePage?.layers.filter(l => l.selection).length || 0;
            
            const newLayerId = `selection-${Date.now()}`; // Benzersiz ID
            const newLayer: Layer = {
                id: newLayerId,
                name: `Secili alan ${selectionCount + 1}`,
                isVisible: true,
                selection: { ...currentSelection }
            };

            setPages(prev => prev.map(p => 
                p.id === activePageId ? { ...p, layers: [newLayer, ...p.layers] } : p
            ));

            // OTOMATİK SEÇİM: Yeni oluşturulan katmanı aktif yapar
            setActiveLayerId(newLayerId);
        }
        
        // State'leri sıfırla
        setSelectionStart(null);
        setCurrentSelection(null);
    };

    return {
        startSelection,
        moveSelection,
        endSelection,
        drawingSelection: currentSelection // Canvas.tsx'te anlık önizleme için
    };
}

// --- Tuval Üzerindeki Seçim Kutusu ve Taşıma Lojiği ---
interface SelectionBoxProps {
    layer: any;
    isActive: boolean;
    canvasSize: { width: number; height: number };
    scale: number;
    onUpdate: (id: string, newSelection: { x: number; y: number; w: number; h: number }) => void;
    allSelections?: { x: number; y: number; w: number; h: number; id: string }[]; // Üst üste binme kontrolü için
}

export function SelectionBox({ layer, isActive, canvasSize, scale, onUpdate, allSelections }: SelectionBoxProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

    // AI katmanları sabit kalır — taşıma/boyutlandırma yok
    const isAILayer = layer.id.startsWith('layer-ai-');

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || isAILayer) return;
        e.stopPropagation(); 
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: layer.selection.x, y: layer.selection.y, w: layer.selection.w, h: layer.selection.h });
    };

    // Boyutlandırma işlemini başlatma
    const handleResizeDown = (e: React.MouseEvent, pos: string) => {
        if (!isActive || isAILayer) return;
        e.stopPropagation();
        setIsResizing(pos);
        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: layer.selection.x, y: layer.selection.y, w: layer.selection.w, h: layer.selection.h });
    };

    // Ref for volatile props to avoid recreating mouse listeners on every drag frame
    const volatileProps = useRef({ layer, onUpdate, scale, canvasSize });
    useEffect(() => {
        volatileProps.current = { layer, onUpdate, scale, canvasSize };
    }, [layer, onUpdate, scale, canvasSize]);

    // Sürükleme ve Boyutlandırma hesaplaması
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging && !isResizing) return;
        const { layer: currentLayer, onUpdate: currentOnUpdate, scale: currentScale, canvasSize: currentCanvasSize } = volatileProps.current;

        const dx = (e.clientX - startPos.x) / currentScale;
        const dy = (e.clientY - startPos.y) / currentScale;

        if (isDragging) {
            let newX = initialRect.x + dx;
            let newY = initialRect.y + dy;

            // TUVAL SINIR KORUMASI
            newX = Math.max(0, Math.min(newX, currentCanvasSize.width - initialRect.w));
            newY = Math.max(0, Math.min(newY, currentCanvasSize.height - initialRect.h));

            currentOnUpdate(currentLayer.id, { ...currentLayer.selection, x: newX, y: newY });
        } else if (isResizing) {
            let { x, y, w, h } = initialRect;

            if (isResizing.includes('w')) {
                x = Math.min(initialRect.x + dx, initialRect.x + initialRect.w - 10);
                w = initialRect.x + initialRect.w - x;
            } else if (isResizing.includes('e')) {
                w = Math.max(10, initialRect.w + dx);
            }

            if (isResizing.includes('n')) {
                y = Math.min(initialRect.y + dy, initialRect.y + initialRect.h - 10);
                h = initialRect.y + initialRect.h - y;
            } else if (isResizing.includes('s')) {
                h = Math.max(10, initialRect.h + dy);
            }

            // TUVAL SINIR KORUMASI
            x = Math.max(0, x);
            y = Math.max(0, y);
            if (x + w > currentCanvasSize.width) w = currentCanvasSize.width - x;
            if (y + h > currentCanvasSize.height) h = currentCanvasSize.height - y;

            currentOnUpdate(currentLayer.id, { ...currentLayer.selection, x, y, w, h });
        }
    }, [isDragging, isResizing, startPos, initialRect]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(null);
    }, []);

    // Global mouse takibi
    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    const isProcessedEmpty = layer.lines && layer.lines.length === 0;
    const hasLines = layer.lines && layer.lines.length > 0;

    // --- MAVİ ALAN PADDİNG HESAPLAMASI (Üst Üste Binme Engeli) ---
    // Her yönde 50px padding istiyoruz ama komşu seçimlerin MOR alanıyla çakışmaması gerekiyor.
    // Komşu mor alanlarla çakışan yönlerde padding sıfıra kadar kırpılır.
    const PADDING = 50;
    let padLeft = PADDING, padTop = PADDING, padRight = PADDING, padBottom = PADDING;

    if (hasLines && allSelections) {
        const sel = layer.selection;
        // Bu katmanın mavi sınırları (padding dahil)
        const blueLeft = sel.x - PADDING;
        const blueTop = sel.y - PADDING;
        const blueRight = sel.x + sel.w + PADDING;
        const blueBottom = sel.y + sel.h + PADDING;

        for (const other of allSelections) {
            if (other.id === layer.id) continue; // Kendini kontrol etme

            // Diğer seçimin MOR alanı (padding'siz)
            const otherLeft = other.x;
            const otherTop = other.y;
            const otherRight = other.x + other.w;
            const otherBottom = other.y + other.h;

            // Yatay örtüşme var mı kontrol et
            const hasHorizontalOverlap = !(otherRight <= sel.x - PADDING || otherLeft >= sel.x + sel.w + PADDING) ||
                                         !(otherRight <= sel.x || otherLeft >= sel.x + sel.w);
            // Dikey örtüşme var mı kontrol et
            const hasVerticalOverlap = !(otherBottom <= sel.y - PADDING || otherTop >= sel.y + sel.h + PADDING) ||
                                       !(otherBottom <= sel.y || otherTop >= sel.y + sel.h);

            // Sol padding'i kırp — sağda bir komşu var ve dikey olarak örtüşüyor
            if (otherRight > blueLeft && otherRight <= sel.x && hasVerticalOverlap) {
                padLeft = Math.min(padLeft, Math.max(0, sel.x - otherRight));
            }
            // Sağ padding'i kırp
            if (otherLeft < blueRight && otherLeft >= sel.x + sel.w && hasVerticalOverlap) {
                padRight = Math.min(padRight, Math.max(0, otherLeft - (sel.x + sel.w)));
            }
            // Üst padding'i kırp
            if (otherBottom > blueTop && otherBottom <= sel.y && hasHorizontalOverlap) {
                padTop = Math.min(padTop, Math.max(0, sel.y - otherBottom));
            }
            // Alt padding'i kırp
            if (otherTop < blueBottom && otherTop >= sel.y + sel.h && hasHorizontalOverlap) {
                padBottom = Math.min(padBottom, Math.max(0, otherTop - (sel.y + sel.h)));
            }
        }
    }

    return (
        <div 
            style={{
                position: 'absolute',
                left: `${layer.selection.x}px`,
                top: `${layer.selection.y}px`,
                width: `${layer.selection.w}px`,
                height: `${layer.selection.h}px`,
                // İşlem görmüş ama yazı bulunamamışsa Kırmızı, aksi halde aktifliğe göre camgöbeği/mor
                border: `2px dashed ${isProcessedEmpty ? 'red' : (isActive ? '#00ffd5' : '#a855f7')}`,
                backgroundColor: isProcessedEmpty ? 'rgba(255, 0, 0, 0.2)' : (isActive ? 'rgba(0, 255, 213, 0.25)' : 'rgba(168, 85, 247, 0.3)'),
                pointerEvents: 'none',
                zIndex: 150
            }}
        >
            {/* YAPAY ZEKA KATMANI EKSTRA ÇİZİMLERİ (Dinamik Padded Mavi Dış Çerçeve, Dolu İse) */}
            {hasLines && (
                <div style={{
                    position: 'absolute',
                    left: `-${padLeft}px`,
                    top: `-${padTop}px`,
                    right: `-${padRight}px`,
                    bottom: `-${padBottom}px`,
                    border: '2px dashed #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    pointerEvents: 'none'
                }} />
            )}
            {/* TAŞIMA VE BOYUTLANDIRMA (Handle) - Sadece manuel katmanlarda ve aktifse görünür */}
            {isActive && !isAILayer && (
                <>
                    {/* BOYUTLANDIRMA KÖŞE TUTAÇLARI (RESIZE HANDLES) */}
                    <div onMouseDown={(e) => handleResizeDown(e, 'nw')} style={{ position: 'absolute', left: '-5px', top: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nwse-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'ne')} style={{ position: 'absolute', right: '-5px', top: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nesw-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'sw')} style={{ position: 'absolute', left: '-5px', bottom: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nesw-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'se')} style={{ position: 'absolute', right: '-5px', bottom: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nwse-resize', pointerEvents: 'auto', zIndex: 160 }} />

                    {/* TAŞIMA BUTONU (MOVE) */}
                    <div 
                        onMouseDown={handleMouseDown}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: '-40px',
                            transform: 'translateX(-50%)',
                            pointerEvents: 'auto',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            zIndex: 160
                        }}
                        className="p-1.5 bg-text text-black rounded-full shadow-[0_0_15px_rgba(0,255,213,0.5)] hover:scale-110 transition-transform flex items-center justify-center"
                    >
                        <Move size={14} />
                    </div>
                </>
            )}
        </div>
    );
}