// app/components/Tools/kaydırma.tsx
"use client";
import React from "react";
import { FaHandMiddleFinger } from "react-icons/fa";

interface HandleProps {
    isActive?: boolean;
    isProcessing?: boolean;
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