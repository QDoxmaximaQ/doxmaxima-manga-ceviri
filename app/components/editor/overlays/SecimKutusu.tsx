// app/components/editor/overlays/SecimKutusu.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Move } from "lucide-react";

interface SecimKutusuProps {
    layer: any;
    isActive: boolean;
    canvasSize: { width: number; height: number };
    scale: number;
    onUpdate: (id: string, newSelection: { x: number; y: number; w: number; h: number }) => void;
    allSelections?: { x: number; y: number; w: number; h: number; id: string }[];
}

export function SecimKutusu({ layer, isActive, canvasSize, scale, onUpdate, allSelections }: SecimKutusuProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

    const isAILayer = layer.id.startsWith('layer-ai-');

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || isAILayer) return;
        e.stopPropagation(); 
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: layer.selection.x, y: layer.selection.y, w: layer.selection.w, h: layer.selection.h });
    };

    const handleResizeDown = (e: React.MouseEvent, pos: string) => {
        if (!isActive || isAILayer) return;
        e.stopPropagation();
        setIsResizing(pos);
        setStartPos({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: layer.selection.x, y: layer.selection.y, w: layer.selection.w, h: layer.selection.h });
    };

    const volatileProps = useRef({ layer, onUpdate, scale, canvasSize });
    useEffect(() => {
        volatileProps.current = { layer, onUpdate, scale, canvasSize };
    }, [layer, onUpdate, scale, canvasSize]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging && !isResizing) return;
        const { layer: currentLayer, onUpdate: currentOnUpdate, scale: currentScale, canvasSize: currentCanvasSize } = volatileProps.current;

        const dx = (e.clientX - startPos.x) / currentScale;
        const dy = (e.clientY - startPos.y) / currentScale;

        if (isDragging) {
            let newX = initialRect.x + dx;
            let newY = initialRect.y + dy;

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

    const PADDING = 50;
    let padLeft = PADDING, padTop = PADDING, padRight = PADDING, padBottom = PADDING;

    if (hasLines && allSelections) {
        const sel = layer.selection;
        const blueLeft = sel.x - PADDING;
        const blueTop = sel.y - PADDING;
        const blueRight = sel.x + sel.w + PADDING;
        const blueBottom = sel.y + sel.h + PADDING;

        for (const other of allSelections) {
            if (other.id === layer.id) continue;

            const otherLeft = other.x;
            const otherTop = other.y;
            const otherRight = other.x + other.w;
            const otherBottom = other.y + other.h;

            const hasHorizontalOverlap = !(otherRight <= sel.x - PADDING || otherLeft >= sel.x + sel.w + PADDING) ||
                                         !(otherRight <= sel.x || otherLeft >= sel.x + sel.w);
            const hasVerticalOverlap = !(otherBottom <= sel.y - PADDING || otherTop >= sel.y + sel.h + PADDING) ||
                                       !(otherBottom <= sel.y || otherTop >= sel.y + sel.h);

            if (otherRight > blueLeft && otherRight <= sel.x && hasVerticalOverlap) {
                padLeft = Math.min(padLeft, Math.max(0, sel.x - otherRight));
            }
            if (otherLeft < blueRight && otherLeft >= sel.x + sel.w && hasVerticalOverlap) {
                padRight = Math.min(padRight, Math.max(0, otherLeft - (sel.x + sel.w)));
            }
            if (otherBottom > blueTop && otherBottom <= sel.y && hasHorizontalOverlap) {
                padTop = Math.min(padTop, Math.max(0, sel.y - otherBottom));
            }
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
                border: `2px dashed ${isProcessedEmpty ? 'red' : (isActive ? '#00ffd5' : '#a855f7')}`,
                backgroundColor: isProcessedEmpty ? 'rgba(255, 0, 0, 0.2)' : (isActive ? 'rgba(0, 255, 213, 0.25)' : 'rgba(168, 85, 247, 0.3)'),
                pointerEvents: 'none',
                zIndex: 150
            }}
        >
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
            {isActive && !isAILayer && (
                <>
                    <div onMouseDown={(e) => handleResizeDown(e, 'nw')} style={{ position: 'absolute', left: '-5px', top: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nwse-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'ne')} style={{ position: 'absolute', right: '-5px', top: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nesw-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'sw')} style={{ position: 'absolute', left: '-5px', bottom: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nesw-resize', pointerEvents: 'auto', zIndex: 160 }} />
                    <div onMouseDown={(e) => handleResizeDown(e, 'se')} style={{ position: 'absolute', right: '-5px', bottom: '-5px', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor: 'nwse-resize', pointerEvents: 'auto', zIndex: 160 }} />

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
