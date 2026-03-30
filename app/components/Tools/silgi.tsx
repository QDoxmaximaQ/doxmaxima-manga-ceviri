// app/components/Tools/silgi.tsx
"use client";
import { BsFillEraserFill } from "react-icons/bs";
import React, { useState, useRef } from "react";
import { MangaPage, ToolSettings, Layer } from "../hooks/useLayers"; // Tipler ana dosyadan

interface RevomeProps {
    isActive?: boolean;
    isProcessing?: boolean;
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

        const activePage = pages.find(p => p.id === activePageId);
        const activeLayer = activePage?.layers.find(l => l.id === activeLayerId);

        // KRİTİK: Ana Katman silinemez koruması
        if (!activeLayer || activeLayer.isBase || !activeLayer.dataURL) return;

        const img = new Image();
        img.onload = () => {
            // tempCanvas'ı temizle
            ctx.clearRect(0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);
            
            // Mevcut katmanı tempCanvas'a çiz (tam ekran sığdırarak)
            ctx.globalCompositeOperation = "source-over"; // Normal mod
            ctx.drawImage(img, 0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);

            // Silgi ayarlarını yükle (destination-out ile anında silme modu)
            applyEraserStyle(ctx, toolSettings, true); 

            // Çizim durumunu aktif et (React state güncellenir, canvas.tsx'te orijinal resim gizlenir)
            setIsDrawing(true);
            lastPosRef.current = coords;
            
            // Sadece tıklama yapıldıysa tek nokta sil
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, toolSettings.eraserSize / 2, 0, Math.PI * 2);
            ctx.fill();
        };
        img.src = activeLayer.dataURL;
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
export const applyEraserStyle = (ctx: CanvasRenderingContext2D, settings: ToolSettings, isRealEraser: boolean = false) => {
    ctx.lineWidth = settings.eraserSize; // ToolProps'tan gelen silgi boyutu
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (isRealEraser) {
        // Anında silme modu: alpha kanalını sıfırlar
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = `rgba(0, 0, 0, ${settings.eraserOpacity})`;
        ctx.fillStyle = `rgba(0, 0, 0, ${settings.eraserOpacity})`;
        // Keskinlik
        const blurAmount = (100 - settings.eraserHardness) / 5;
        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = "black";
    } else {
        // Eski maske izi gösterme modu (Geriye uyumluluk veya yedek)
        ctx.strokeStyle = `rgba(255, 255, 255, ${settings.eraserOpacity})`; 
        const blurAmount = (100 - settings.eraserHardness) / 5; 
        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = "white"; 
        ctx.globalCompositeOperation = "source-over";
    }
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

    // 1. tempCanvas tamamen silinmiş yeni veriyi(resmi) kapsıyor.
    // Başka bir canvas yaratmaya veya imaj yüklemeye gerek yok.
    const updatedDataURL = tempCanvas.toDataURL();

    // 2. State'i hemen güncelle
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
    
    // 3. Geçici canvas'ı temizle ve filtreleri sıfırla
    const tCtx = tempCanvas.getContext("2d");
    if (tCtx) {
        tCtx.shadowBlur = 0;
        tCtx.globalCompositeOperation = "source-over"; // Reset
        tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
};