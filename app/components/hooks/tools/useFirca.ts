// app/components/hooks/tools/useFirca.ts
import { useState, useRef } from "react";
import { MangaPage, ToolSettings, Layer } from "../useLayers";

export function useFirca(
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

        const activePage = pages.find(p => p.id === activePageId);
        const activeLayer = activePage?.layers.find(l => l.id === activeLayerId);
        
        const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase && !activeLayer.clipBox;
        const targetId = isBrushLayer ? activeLayerId : `brush-${Date.now()}-${Math.random()}`;

        handleBrushStrokeEnd(tempCanvasRef.current, activePageId, activeLayerId, setPages, targetId!, pages);

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

export const handleBrushStrokeEnd = (
    tempCanvas: HTMLCanvasElement | null,
    activePageId: string | null,
    activeLayerId: string | null,
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    targetLayerId: string,
    pages: MangaPage[]
) => {
    if (!tempCanvas || !activePageId) return;

    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const activeLayer = page.layers.find(l => l.id === activeLayerId);
    const isBrushLayer = activeLayer && activeLayer.dataURL && !activeLayer.isBase && !activeLayer.clipBox;

    if (isBrushLayer && activeLayer.dataURL) {
        const strokeDataURL = tempCanvas.toDataURL();
        const canvasWidth = tempCanvas.width;
        const canvasHeight = tempCanvas.height;

        const tCtx = tempCanvas.getContext("2d");
        if (tCtx) {
            tCtx.globalAlpha = 1.0;
            tCtx.shadowBlur = 0;
            tCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }

        const existingImg = new Image();
        const strokeImg = new Image();
        let loadedCount = 0;

        const tryMerge = () => {
            loadedCount++;
            if (loadedCount < 2) return; 

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

        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
    }
};

export const applyBrushStyle = (ctx: CanvasRenderingContext2D, settings: ToolSettings) => {
    ctx.lineWidth = settings.brushSize; 
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = settings.brushColor; 
    ctx.globalAlpha = settings.brushOpacity;
    const blurAmount = (100 - settings.brushHardness) / 5; 
    ctx.shadowBlur = blurAmount;
    ctx.shadowColor = settings.brushColor;
};
