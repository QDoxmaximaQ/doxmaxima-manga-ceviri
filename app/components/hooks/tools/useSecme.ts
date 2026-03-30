// app/components/hooks/tools/useSecme.ts
import { useState } from "react";
import { MangaPage, Layer } from "../useLayers"; 

export function useSecme(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setActiveLayerId: (id: string | null) => void 
) {
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [currentSelection, setCurrentSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const startSelection = (coords: { x: number, y: number }) => {
        setSelectionStart(coords);
    };

    const moveSelection = (coords: { x: number, y: number }) => {
        if (!selectionStart) return;
        
        setCurrentSelection({
            x: Math.min(coords.x, selectionStart.x),
            y: Math.min(coords.y, selectionStart.y),
            w: Math.abs(coords.x - selectionStart.x),
            h: Math.abs(coords.y - selectionStart.y)
        });
    };

    const endSelection = () => {
        if (currentSelection && currentSelection.w > 5 && currentSelection.h > 5 && activePageId) {
            const activePage = pages.find(p => p.id === activePageId);
            const selectionCount = activePage?.layers.filter(l => l.selection).length || 0;
            
            const newLayerId = `selection-${Date.now()}`; 
            const newLayer: Layer = {
                id: newLayerId,
                name: `Secili alan ${selectionCount + 1}`,
                isVisible: true,
                selection: { ...currentSelection }
            };

            setPages(prev => prev.map(p => 
                p.id === activePageId ? { ...p, layers: [newLayer, ...p.layers] } : p
            ));

            setActiveLayerId(newLayerId);
        }
        
        setSelectionStart(null);
        setCurrentSelection(null);
    };

    return {
        startSelection,
        moveSelection,
        endSelection,
        drawingSelection: currentSelection 
    };
}
