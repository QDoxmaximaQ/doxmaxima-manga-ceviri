// app/components/Tools/otoSecme.tsx
"use client";

import React from "react";
import { Wand2 } from "lucide-react";

export default function Otosecme({ isActive, isProcessing, onClick }: any) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                    : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Yapay Zeka ile Oto Seçim"
            >
                <Wand2 size={18} className={isProcessing ? "animate-spin" : ""} />
            </button>
        </section>
    );
}
