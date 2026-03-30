// app/components/Tools/silgi.tsx
"use client";
import { BsFillEraserFill } from "react-icons/bs";
import React from "react";

interface RevomeProps {
    isActive?: boolean;
    isProcessing?: boolean;
    onClick?: () => void;
}

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