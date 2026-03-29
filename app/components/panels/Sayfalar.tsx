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

export default function Sayfalar({ pages, activePageId, setActivePageId, onDeletePage, onClose }: SayfalarProps) {
    return (
        <div className="flex flex-col h-full bg-backg overflow-hidden">
            {/* BAŞLIK */}
            <div className="flex h-9 shrink-0 items-center justify-between px-4 bg-white/2 border-b border-white/10 z-10">
                <div className="flex items-center gap-2 text-text">
                    <Copy size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sayfalar ({pages?.length || 0})</span>
                </div>
                <button onClick={onClose} className="text-texts/30 hover:text-red-500 transition-colors">
                    <CircleX size={14} />
                </button>
            </div>

            {/* KART ALANI */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {pages?.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 gap-2 py-10">
                        <ImageIcon size={32} />
                        <p className="text-[9px] font-bold uppercase tracking-widest text-center">Henüz sayfa eklenmedi</p>
                    </div>
                ) : (
                    /*
                     * Sabit 100px kart - panel büyüyünce gap artar, kart boyutu değişmez.
                     * Yeterli alan olunca yeni sütun açılır.
                     */
                    <div
                        className="grid"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fill, 100px)',
                            justifyContent: 'start',
                            gap: '10px',
                        }}
                    >
                        {pages?.map((page, index) => (
                            <div
                                key={page.id}
                                onClick={() => setActivePageId(page.id)}
                                style={{ aspectRatio: '9 / 16' }}
                                className={`group relative w-full cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-300 bg-[#1c1c27]
                                    ${activePageId === page.id
                                        ? 'border-text shadow-[0_0_14px_rgba(0,255,213,0.3)] scale-[1.02]'
                                        : 'border-white/5 hover:border-white/20 hover:scale-[1.01]'
                                    }`}
                            >
                                {/* Sayfa No */}
                                <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[7px] font-black border border-white/10 leading-none">
                                    {index + 1}
                                </div>

                                {/* Aktif nokta rozeti */}
                                {activePageId === page.id && (
                                    <div className="absolute bottom-1.5 left-1.5 z-10 w-1.5 h-1.5 rounded-full bg-text shadow-[0_0_6px_rgba(0,255,213,0.8)]" />
                                )}

                                {/* Sil Butonu */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                                    className="absolute top-1.5 right-1.5 z-20 p-0.5 bg-red-500/80 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                    <CircleX size={9} />
                                </button>

                                {/* Thumbnail */}
                                <img
                                    src={page.url}
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                    alt={`Sayfa ${index + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}