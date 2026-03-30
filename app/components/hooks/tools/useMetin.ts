// app/components/hooks/tools/useMetin.ts
import { useState } from "react";
import { MangaPage, Layer, ToolSettings } from "../useLayers"; 

export function useMetin(
    activePageId: string | null, 
    pages: MangaPage[], 
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setActiveLayerId: (id: string | null) => void,
    toolSettings: ToolSettings 
) {
    const [textStart, setTextStart] = useState<{ x: number, y: number } | null>(null);
    const [currentTextRect, setCurrentTextRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const startText = (coords: { x: number, y: number }) => {
        setTextStart(coords);
    };

    const moveText = (coords: { x: number, y: number }) => {
        if (!textStart) return;
        setCurrentTextRect({
            x: Math.min(coords.x, textStart.x),
            y: Math.min(coords.y, textStart.y),
            w: Math.abs(coords.x - textStart.x),
            h: Math.abs(coords.y - textStart.y)
        });
    };

    const endText = () => {
        if (currentTextRect && currentTextRect.w > 10 && currentTextRect.h > 10 && activePageId) {
            const activePage = pages.find(p => p.id === activePageId);
            const textCount = activePage?.layers.filter(l => l.text !== undefined).length || 0;

            const newId = `text-${Date.now()}`; 
            
            const newLayer: Layer = {
                id: newId,
                name: `Metin ${textCount + 1}`,
                isVisible: true,
                text: "", 
                textConfig: { 
                    x: currentTextRect.x, 
                    y: currentTextRect.y, 
                    w: currentTextRect.w, 
                    h: currentTextRect.h, 
                    fontSize: 16, 
                    color: toolSettings.textColor,    
                    fontFamily: toolSettings.textFont 
                }
            };

            setPages(prev => prev.map(p => 
                p.id === activePageId ? { ...p, layers: [newLayer, ...p.layers] } : p
            ));

            setActiveLayerId(newId);
        }
        setTextStart(null);
        setCurrentTextRect(null);
    };

    return {
        startText,
        moveText,
        endText,
        drawingText: currentTextRect
    };
}
