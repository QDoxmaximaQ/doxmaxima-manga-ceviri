// app/components/Tools/secme.tsx
"use client";

import { PiCursorFill } from "react-icons/pi";
import React from "react";

interface SecmeProps {
    isActive?: boolean;
    isProcessing?: boolean;
    onClick?: () => void;
}

export default function Secme({ isActive, onClick }: SecmeProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Seçme Aracı (M)"
            >
                <PiCursorFill size={18} />
            </button>
        </section>
    );
}