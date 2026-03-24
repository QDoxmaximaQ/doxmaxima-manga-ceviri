// app/components/Tools/silgi.tsx
"use client";
import { BsFillEraserFill } from "react-icons/bs";
import React, { useState, useRef } from "react";
import { MangaPage, ToolSettings, Layer } from "../hooks/useLayers"; // Tipler ana dosyadan

interface RevomeProps {
    isActive?: boolean;
    onClick?: () => void;
}

/**
 * Silgi Aracı Bileşeni (Sol Panel İkonu)
 */
export default function Remove({ isActive, onClick }: RevomeProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Silgi Aracı (E)"
            >
                <BsFillEraserFill size={18} />
            </button>
        </section>
    );
}

/**
 * --- SİLGİ HOOK'U ---
 * Silgi işleminin tüm iç durumunu ve çizim sürecini yönetir.
 * Canvas.tsx içerisinde sadece ilgili fonksiyonlar çağrılır.
 */
export function useEraser(
    tempCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    activePageId: string | null,
    activeLayerId: string | null,
    pages: MangaPage[],
    toolSettings: ToolSettings,
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>
) {
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPosRef = useRef({ x: 0, y: 0 });

    const startEraser = (coords: { x: number; y: number }) => {
        if (!activePageId) return;
        const ctx = tempCanvasRef.current?.getContext("2d");
        if (!ctx) return;

        setIsDrawing(true);
        lastPosRef.current = coords;
        applyEraserStyle(ctx, toolSettings); // Silgi stilini uygula
    };

    const moveEraser = (coords: { x: number; y: number }) => {
        if (!isDrawing) return;
        const ctx = tempCanvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastPosRef.current = coords;
    };

    const endEraser = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        // Silme bittiğinde maskeleme işlemini (katman güncellemesini) başlatır
        handleEraserStrokeEnd(tempCanvasRef.current, activePageId, activeLayerId, pages, setPages);
    };

    return { 
        startEraser, 
        moveEraser, 
        endEraser, 
        isDrawingEraser: isDrawing 
    };
}

/**
 * Silgi stil ayarları (Boyut, Opaklık ve Keskinlik)
 */
export const applyEraserStyle = (ctx: CanvasRenderingContext2D, settings: ToolSettings) => {
    ctx.lineWidth = settings.eraserSize; // ToolProps'tan gelen silgi boyutu
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Silgi izini tempCanvas üzerinde beyaz/opak bir maske olarak gösteririz
    ctx.strokeStyle = `rgba(255, 255, 255, ${settings.eraserOpacity})`; 
    
    // Keskinlik (Hardness) ayarı: Shadow blur ile yumuşaklık verilir
    const blurAmount = (100 - settings.eraserHardness) / 5; 
    ctx.shadowBlur = blurAmount;
    ctx.shadowColor = "white"; 
    
    ctx.globalCompositeOperation = "source-over"; // Çizimi tempCanvas üzerinde görünür yap
};

/**
 * Silme işlemi bittiğinde katman verisini güncelleyen lojik
 */
export const handleEraserStrokeEnd = (
    tempCanvas: HTMLCanvasElement | null,
    activePageId: string | null,
    activeLayerId: string | null,
    pages: MangaPage[], 
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>
) => {
    if (!tempCanvas || !activePageId || !activeLayerId) return;

    const activePage = pages.find(p => p.id === activePageId);
    const activeLayer = activePage?.layers.find(l => l.id === activeLayerId);

    // KRİTİK: Ana Katman silinemez koruması ve katman kontrolü
    if (!activeLayer || activeLayer.isBase || !activeLayer.dataURL) {
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.shadowBlur = 0;
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        return;
    }

    // Mevcut katman resmini yükleyerek asenkron maskeleme işlemi
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = tempCanvas.width;
        canvas.height = tempCanvas.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            // 1. Mevcut katman içeriğini çiz
            ctx.drawImage(img, 0, 0);
            
            // 2. Silme moduna geç (destination-out: çizilen yerleri alttaki resimden çıkarır)
            ctx.globalCompositeOperation = "destination-out";
            
            // 3. tempCanvas'taki darbeyi bu maske ile uygula
            ctx.drawImage(tempCanvas, 0, 0);
            
            const updatedDataURL = canvas.toDataURL();

            // 4. State'i güncelle
            setPages(prev => prev.map(page => {
                if (page.id === activePageId) {
                    return {
                        ...page,
                        layers: page.layers.map(l => 
                            l.id === activeLayerId ? { ...l, dataURL: updatedDataURL } : l
                        )
                    };
                }
                return page;
            }));
        }
        
        // İşlem bitince geçici canvas'ı temizle ve blur ayarını sıfırla
        const tCtx = tempCanvas.getContext("2d");
        if (tCtx) {
            tCtx.shadowBlur = 0;
            tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
    };

    img.src = activeLayer.dataURL;
};