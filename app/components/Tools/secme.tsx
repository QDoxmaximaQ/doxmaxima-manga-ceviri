// app/components/Tools/secme.tsx
"use client";

import { PiCursorFill } from "react-icons/pi";
import { Move } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
// Tipleri merkezi hook dosyasından çekiyoruz
import { MangaPage, Layer } from "../hooks/useLayers"; 

// --- Araç Çubuğu Butonu (Sidebar) ---
interface SecmeProps {
    isActive?: boolean;
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
}

export function SelectionBox({ layer, isActive, canvasSize, scale, onUpdate }: SelectionBoxProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState({ x: 0, y: 0 });

    // Taşıma işlemini başlatma
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive) return;
        e.stopPropagation(); 
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: layer.selection.x, y: layer.selection.y });
    };

    // Sürükleme hesaplaması
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const dx = (e.clientX - startPos.x) / scale;
        const dy = (e.clientY - startPos.y) / scale;

        let newX = initialRect.x + dx;
        let newY = initialRect.y + dy;

        // TUVAL SINIR KORUMASI
        newX = Math.max(0, Math.min(newX, canvasSize.width - layer.selection.w));
        newY = Math.max(0, Math.min(newY, canvasSize.height - layer.selection.h));

        onUpdate(layer.id, {
            ...layer.selection,
            x: newX,
            y: newY
        });
    }, [isDragging, startPos, initialRect, layer, canvasSize, scale, onUpdate]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Global mouse takibi
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div 
            style={{
                position: 'absolute',
                left: `${layer.selection.x}px`,
                top: `${layer.selection.y}px`,
                width: `${layer.selection.w}px`,
                height: `${layer.selection.h}px`,
                // Aktiflik durumuna göre renk değişimi
                border: `2px dashed ${isActive ? '#00ffd5' : '#a855f7'}`,
                backgroundColor: isActive ? 'rgba(0, 255, 213, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                pointerEvents: 'none',
                zIndex: 150
            }}
        >
            {/* TAŞIMA OKU (Handle) - Sadece katman aktifse görünür */}
            {isActive && (
                <div 
                    onMouseDown={handleMouseDown}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '-35px',
                        transform: 'translateX(-50%)',
                        pointerEvents: 'auto',
                        cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    className="p-2 bg-text text-black rounded-full shadow-[0_0_15px_rgba(0,255,213,0.5)] hover:scale-110 transition-transform flex items-center justify-center"
                >
                    <Move size={16} />
                </div>
            )}
        </div>
    );
}