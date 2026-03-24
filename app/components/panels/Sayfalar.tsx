// app/components/panels/Sayfalar.tsx
"use client";
import React from "react";
import { CircleX, Copy, ImageIcon } from 'lucide-react';

interface SayfalarProps {
    pages: any[];
    activePageId: string | null;
    setActivePageId: (id: string) => void;
    onDeletePage: (id: string) => void;
    onClose?: () => void;
    width: number;
}

export default function Sayfalar({ pages, activePageId, setActivePageId, onDeletePage, onClose, width }: SayfalarProps) {
    
    // Panel genişliğine göre sütun sayısını hesaplıyoruz
    const getGridCols = () => {
        if (width > 450) return 'grid-cols-3'; 
        return 'grid-cols-2'; 
    };

    return (
        <div className="flex flex-col h-full bg-backg overflow-hidden">
            {/* BAŞLIK (HEADER) - shrink-0: Asla küçülmez */}
            <div className="flex h-9 shrink-0 items-center justify-between px-4 bg-white/2 border-b border-white/10 z-10">
                <div className="flex items-center gap-2 text-text">
                    <Copy size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sayfalar ({pages?.length || 0})</span>
                </div>
                <button onClick={onClose} className="text-texts/30 hover:text-red-500 transition-colors">
                    <CircleX size={14}/>
                </button>
            </div>

            {/*kart yapısı */}
            <div className={`flex-1 grid ${getGridCols()} gap-3 m-2 overflow-y-auto custom-scrollbar p-3 shadow-inner content-start`}>
                {pages?.length === 0 ? (
                    <div className="col-span-full h-full flex flex-col items-center justify-center opacity-10 gap-2 py-10">
                        <ImageIcon size={32} />
                        <p className="text-[9px] font-bold uppercase tracking-widest text-center">Henüz sayfa eklenmedi</p>
                    </div>
                ) : (
                    pages?.map((page, index) => (
                        <div 
                            key={page.id}
                            onClick={() => setActivePageId(page.id)}
                            className={`group relative h-45 w-full rounded-lg border-2 cursor-pointer overflow-hidden transition-all duration-300 bg-[#222222]
                                ${activePageId === page.id ? 'border-text shadow-[0_0_15px_rgba(0,255,213,0.3)] scale-[1.02]' : 'border-white/5 hover:border-white/20'}`}
                        >
                            {/* Sayfa No */}
                            <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black border border-white/10">
                                {index + 1}
                            </div>

                            {/* X Butonu */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                                className="absolute top-1.5 right-1.5 z-20 p-1 bg-red-500/80 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                            >
                                <CircleX size={10} />
                            </button>
                            
                            <img src={page.url} className="w-full h-full object-cover pointer-events-none" alt="" />
                            
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}