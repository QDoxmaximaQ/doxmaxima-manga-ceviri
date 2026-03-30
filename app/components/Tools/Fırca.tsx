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
    isProcessing?: boolean;
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

        // Katman Durum Kontrolü: Eğer aktif katman bir resim verisine sahipse, ancak "isBase" veya "clipBox" taşımıyorsa üzerine çizilebilir
        // Böylece yüksek çözünürlüklü asıl resim veya yapay zeka kesitleri (Arkaplan) boyutlandırma hatasına uğramaz, yeni Fırça katmanı açılır.
        const activePage = pages.find(p => p.id === activePageId);
        const activeLayer = activePage?.layers.find(l => l.id === activeLayerId);
        
        const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase && !activeLayer.clipBox;

        const targetId = isBrushLayer ? activeLayerId : `brush-${Date.now()}-${Math.random()}`;

        // Çizimi katmanlara işle
        handleBrushStrokeEnd(tempCanvasRef.current, activePageId, activeLayerId, setPages, targetId!, pages);

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
    targetLayerId: string,
    pages: MangaPage[]
) => {
    if (!tempCanvas || !activePageId) return;

    // Mevcut state'i doğrudan oku (closure yerine parametre olarak geçildi)
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const activeLayer = page.layers.find(l => l.id === activeLayerId);
    const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase && !activeLayer.clipBox;

    if (isBrushLayer && activeLayer.dataURL) {
        // --- MEVCUT KATMANA BİRLEŞTİRME (Asenkron) ---
        // tempCanvas'ın anlık verisini hemen yakala (sonra temizlenebilir)
        const strokeDataURL = tempCanvas.toDataURL();
        const canvasWidth = tempCanvas.width;
        const canvasHeight = tempCanvas.height;

        // tempCanvas'ı hemen temizle (yeni çizimlere hazır olsun)
        const tCtx = tempCanvas.getContext("2d");
        if (tCtx) {
            tCtx.globalAlpha = 1.0;
            tCtx.shadowBlur = 0;
            tCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }

        // Birleştirme işlemini setPages dışında yap
        const existingImg = new Image();
        const strokeImg = new Image();
        let loadedCount = 0;

        const tryMerge = () => {
            loadedCount++;
            if (loadedCount < 2) return; // Her iki resim de yüklenene kadar bekle

            const mergeCanvas = document.createElement("canvas");
            mergeCanvas.width = canvasWidth;
            mergeCanvas.height = canvasHeight;
            const mCtx = mergeCanvas.getContext("2d");

            if (mCtx) {
                mCtx.drawImage(existingImg, 0, 0);
                mCtx.drawImage(strokeImg, 0, 0);
                const mergedData = mergeCanvas.toDataURL();

                setPages(prev => prev.map(p => {
                    if (p.id === activePageId) {
                        return {
                            ...p,
                            layers: p.layers.map(l =>
                                l.id === activeLayerId ? { ...l, dataURL: mergedData } : l
                            )
                        };
                    }
                    return p;
                }));
            }
        };

        existingImg.onload = tryMerge;
        strokeImg.onload = tryMerge;
        existingImg.src = activeLayer.dataURL;
        strokeImg.src = strokeDataURL;

    } else {
        // --- YENİ KATMAN OLUŞTURMA (Senkron) ---
        const strokeData = tempCanvas.toDataURL();

        setPages(prev => prev.map(p => {
            if (p.id === activePageId) {
                const brushCount = p.layers.filter(l => l.name.startsWith("Fırca")).length;
                const newLayer: Layer = {
                    id: targetLayerId,
                    name: `Fırca ${brushCount + 1}`,
                    isVisible: true,
                    dataURL: strokeData
                };
                return { ...p, layers: [newLayer, ...p.layers] };
            }
            return p;
        }));

        // tempCanvas'ı temizle
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
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