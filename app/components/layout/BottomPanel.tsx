// app/components/layout/BottomPanel.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, UploadCloud, Download } from 'lucide-react';

// Prop tipini dizi (string[]) alacak şekilde güncelledik
interface BottomPanelProps {
    onImagesUpload: (imageUrls: string[]) => void;
    systemMessage: { text: string; color: string };
}

export default function Bottompanel({ onImagesUpload, systemMessage }: BottomPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // 1. Dosyaları diziye çevir ve sadece resimleri filtrele
        // 2. İsimlerine göre "Natural Sort" (0-9, a-z) yapıyoruz
        const sortedFiles = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        if (sortedFiles.length === 0) {
            alert("Lütfen geçerli resim dosyaları seçin!");
            return;
        }

        // URL'leri oluştur ve topluca gönder
        const urls = sortedFiles.map(file => URL.createObjectURL(file));
        onImagesUpload(urls);
        
        // Aynı dosyaları tekrar seçebilmek için inputu sıfırla
        e.target.value = "";
    };

    return (
        <footer className="flex h-16 items-center justify-between border-t border-white/10 bg-backg px-8 relative z-50">
            {/* multiple ekledik: Artık birden fazla dosya seçilebilir */}
            <input 
                type="file" 
                multiple
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
            />

            <div className="flex items-center gap-3 w-1/4">
                <FooterButton 
                    onClick={() => fileInputRef.current?.click()} 
                    icon={<UploadCloud size={16} />} 
                    text="Dosyaları Aç" 
                    color="bg-white/5 hover:bg-white/10" 
                />
                <FooterButton icon={<Download size={16} />} text="İndir" color="bg-white/5" />
            </div>

            <div className="flex h-10 w-2/5 items-center justify-between rounded-lg border border-white/5 bg-black/40 px-5">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-text"></span>
                    </div>
                    <span className={`text-[9px] font-mono uppercase tracking-[0.2em] font-bold ${systemMessage.color}`}>
                        {systemMessage.text}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3 w-1/4 justify-end">
                <FooterButton icon={<Square size={14} fill="currentColor" />} text="Durdur" color="bg-red-500/5" textColor="text-red-500" />
                <FooterButton icon={<Play size={14} fill="black" />} text="Başlat" color="bg-text" textColor="text-black" glow />
            </div>
        </footer>
    );
}

function FooterButton({ icon, text, color, textColor = "text-texts/70", glow, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center justify-center gap-2 px-5 h-9 ${color} ${textColor} border border-white/5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${glow && 'shadow-[0_0_20px_rgba(0,255,213,0.15)]'}`}
        >
            {icon}
            <span className="hidden lg:block">{text}</span>
        </button>
    );
}