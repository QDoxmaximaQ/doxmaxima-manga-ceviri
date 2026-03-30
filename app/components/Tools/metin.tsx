// app/components/Tools/metin.tsx
"use client";

import { FiType } from "react-icons/fi";
import React from "react";

interface MetinProps {
    isActive?: boolean;
    isProcessing?: boolean;
    onClick?: () => void;
}

export default function Metin({ isActive, onClick }: MetinProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Metin Aracı (T)"
            >
                <FiType size={18} />
            </button>
        </section>
    );
}