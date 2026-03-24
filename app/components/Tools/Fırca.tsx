// app/components/Tools/Fırca.tsx
"use client";

import { Brush } from "lucide-react";
import React, { useState, useRef } from "react";
// Merkezi tipleri useLayers hook'undan çekiyoruz
import { MangaPage, Layer, ToolSettings } from "../hooks/useLayers"; 

/**
 * Fırça Aracı Bileşeni (Sol Panel İkonu)
 */
interface FırcaProps {
    isActive?: boolean;
    onClick?: () => void;
}

export default function Fırca({ isActive, onClick }: FırcaProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Fırça Aracı (B)"
            >
                <Brush size={18} fill="currentColor" />
            </button>
        </section>
    );
}

/**
 * --- FIRÇA HOOK'U ---
 * Bu hook fırçanın tüm çizim sürecini yönetir.
 * @param pages: Mevcut katmanların fırça katmanı olup olmadığını kontrol etmek için kullanılır.
 * @param setActiveLayerId: Yeni katman eklendiğinde otomatik seçimi tetiklemek için kullanılır.
 */
export function useBrush(
    tempCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    activePageId: string | null,
    activeLayerId: string | null,
    pages: MangaPage[], 
    toolSettings: ToolSettings,
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setActiveLayerId: (id: string | null) => void 
) {
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPosRef = useRef({ x: 0, y: 0 });

    const startBrush = (coords: { x: number; y: number }) => {
        if (!activePageId) return;
        const ctx = tempCanvasRef.current?.getContext("2d");
        if (!ctx) return;

        setIsDrawing(true);
        lastPosRef.current = coords;
        applyBrushStyle(ctx, toolSettings);
    };

    const moveBrush = (coords: { x: number; y: number }) => {
        if (!isDrawing) return;
        const ctx = tempCanvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastPosRef.current = coords;
    };

    const endBrush = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        // Katman Durum Kontrolü: Eğer aktif katman bir fırça katmanı değilse yeni ID oluştur
        const activePage = pages.find(p => p.id === activePageId);
        const activeLayer = activePage?.layers.find(l => l.id === activeLayerId);
        // "Ana Katman" üzerine doğrudan çizim yapılamaz, yeni katman açılır
        const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase;

        const targetId = isBrushLayer ? activeLayerId : `brush-${Date.now()}-${Math.random()}`;

        // Çizimi katmanlara işle
        handleBrushStrokeEnd(tempCanvasRef.current, activePageId, activeLayerId, setPages, targetId!);

        // Eğer yeni bir katman oluşturulduysa otomatik olarak o katmanı seç
        if (!isBrushLayer) {
            setActiveLayerId(targetId);
        }
    };

    return { 
        startBrush, 
        moveBrush, 
        endBrush, 
        isDrawingBrush: isDrawing 
    };
}

/**
 * --- FIRÇA KOMUTLARI (LOJİK) ---
 */

export const handleBrushStrokeEnd = (
    tempCanvas: HTMLCanvasElement | null,
    activePageId: string | null,
    activeLayerId: string | null,
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    targetLayerId: string 
) => {
    if (!tempCanvas || !activePageId) return;

    const strokeData = tempCanvas.toDataURL();

    setPages(prev => prev.map(page => {
        if (page.id === activePageId) {
            const activeLayer = page.layers.find(l => l.id === activeLayerId);
            const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase;

            if (isBrushLayer) {
                // --- MEVCUT KATMANI GÜNCELLE (Üst üste çizim) ---
                const mergeCanvas = document.createElement("canvas");
                mergeCanvas.width = tempCanvas.width;
                mergeCanvas.height = tempCanvas.height;
                const mCtx = mergeCanvas.getContext("2d");

                if (mCtx) {
                    const existingImg = new Image();
                    existingImg.src = activeLayer.dataURL!;
                    mCtx.drawImage(existingImg, 0, 0);
                    mCtx.drawImage(tempCanvas, 0, 0);
                    const mergedData = mergeCanvas.toDataURL();

                    return {
                        ...page,
                        layers: page.layers.map(l => 
                            l.id === activeLayerId ? { ...l, dataURL: mergedData } : l
                        )
                    };
                }
            }

            // --- YENİ KATMAN OLUŞTURMA ---
            const brushCount = page.layers.filter(l => l.name.startsWith("Fırca")).length;
            const newLayer: Layer = {
                id: targetLayerId,
                name: `Fırca ${brushCount + 1}`,
                isVisible: true,
                dataURL: strokeData
            };

            return { 
                ...page, 
                layers: [newLayer, ...page.layers] 
            };
        }
        return page;
    }));

    // Geçici tuvali temizle
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
        ctx.globalAlpha = 1.0; 
        ctx.shadowBlur = 0;    
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
};

/**
 * Fırça Stilini Uygula (Boyut, Renk, Opaklık ve Sertlik)
 */
export const applyBrushStyle = (ctx: CanvasRenderingContext2D, settings: ToolSettings) => {
    ctx.lineWidth = settings.brushSize; 
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = settings.brushColor; 
    ctx.globalAlpha = settings.brushOpacity;
    // Sertlik (Hardness) ayarını gölge bulanıklığı ile simüle ediyoruz
    const blurAmount = (100 - settings.brushHardness) / 5; 
    ctx.shadowBlur = blurAmount;
    ctx.shadowColor = settings.brushColor;
};