// app/components/hooks/tools/useSilgi.ts
import { useState, useRef } from "react";
import { MangaPage, ToolSettings, Layer } from "../useLayers"; 

export function useSilgi(
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

        if (!activeLayer || activeLayer.isBase || !activeLayer.dataURL) return;

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);
            
            ctx.globalCompositeOperation = "source-over"; // Normal mod
            ctx.drawImage(img, 0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);

            applyEraserStyle(ctx, toolSettings, true); 

            setIsDrawing(true);
            lastPosRef.current = coords;
            
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
        handleEraserStrokeEnd(tempCanvasRef.current, activePageId, activeLayerId, pages, setPages);
    };

    return { 
        startEraser, 
        moveEraser, 
        endEraser, 
        isDrawingEraser: isDrawing 
    };
}

export const applyEraserStyle = (ctx: CanvasRenderingContext2D, settings: ToolSettings, isRealEraser: boolean = false) => {
    ctx.lineWidth = settings.eraserSize; 
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (isRealEraser) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = `rgba(0, 0, 0, ${settings.eraserOpacity})`;
        ctx.fillStyle = `rgba(0, 0, 0, ${settings.eraserOpacity})`;
        const blurAmount = (100 - settings.eraserHardness) / 5;
        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = "black";
    } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${settings.eraserOpacity})`; 
        const blurAmount = (100 - settings.eraserHardness) / 5; 
        ctx.shadowBlur = blurAmount;
        ctx.shadowColor = "white"; 
        ctx.globalCompositeOperation = "source-over";
    }
};

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

    if (!activeLayer || activeLayer.isBase || !activeLayer.dataURL) {
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.shadowBlur = 0;
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        return;
    }

    const updatedDataURL = tempCanvas.toDataURL();

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
    
    const tCtx = tempCanvas.getContext("2d");
    if (tCtx) {
        tCtx.shadowBlur = 0;
        tCtx.globalCompositeOperation = "source-over"; // Reset
        tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
};
