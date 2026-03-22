"use client";
import React, { useState, useCallback, useEffect } from "react";
import { FaHandMiddleFinger } from "react-icons/fa";

// --- 1. KAYDIRMA MANTIĞI (HOOK) ---
// Bu fonksiyonu Canvas.tsx içinde çağıracağız
export function useHandleLogic(activeTool: string) {
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

// --- 2. BUTON GÖRÜNÜMÜ ---
interface HandleProps {
    isActive?: boolean;
    onClick?: () => void;
}

export default function Handle({ isActive, onClick }: HandleProps) {
    return (
        <button 
            onClick={onClick}
            className={`p-2 rounded-xl transition-all duration-200 ${
                isActive 
                ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110' 
                : 'text-texts/50 hover:text-texts hover:bg-white/5'
            }`}
            title="Kaydırma Aracı (H)"
        >
            <FaHandMiddleFinger size={18} />
        </button>
    );
}