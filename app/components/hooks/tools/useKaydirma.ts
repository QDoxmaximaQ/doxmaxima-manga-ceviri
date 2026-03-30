// app/components/hooks/tools/useKaydirma.ts
import { useState, useCallback, useEffect } from "react";

export function useKaydirma(activeTool: string) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool !== 'handle') return;
        setIsDragging(true);
        setStartPos({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || activeTool !== 'handle') return;
        setPosition({
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        });
    }, [isDragging, startPos, activeTool]);

    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);

    return { position, isDragging, handleMouseDown };
}
