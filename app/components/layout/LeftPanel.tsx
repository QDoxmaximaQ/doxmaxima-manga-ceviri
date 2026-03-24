// app/components/layout/LeftPanel.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Pin, Edit3, ChevronRight } from 'lucide-react';

// Araç bileşenlerini import ediyoruz
import Fırca from "../Tools/Fırca";
import Handle from "../Tools/kaydırma";
import Metin from "../Tools/metin";
import Remove from "../Tools/silgi";
import Secme from "../Tools/secme";
import Otosecme from "../Tools/otoSecme";

// Araçların ID ve Bileşen eşleşmesi
const INITIAL_TOOLS = [
    { id: "handle", Component: Handle },
    { id: "secme", Component: Secme },
    { id: "otosecme", Component: Otosecme },
    { id: "fırca", Component: Fırca },
    { id: "metin", Component: Metin },
    { id: "remove", Component: Remove },
];

// Page.tsx'den gelecek olan prop tanımları
interface LeftPanelProps {
    activeTool: string;
    setActiveTool: (id: string) => void;
    isCanvasEmpty?: boolean;
    setSystemMessage: (msg: { text: string; color: string }) => void;
}

export default function Leftpanel({ activeTool, setActiveTool, isCanvasEmpty = false, setSystemMessage }: LeftPanelProps) {
    const [isPinned, setIsPinned] = useState(true);
    const [width, setWidth] = useState(64);
    const [isResizing, setIsResizing] = useState(false);
    
    // YENİ STATE'LER
    const [isEditing, setIsEditing] = useState(false); // Düzenleme modu
    const [tools, setTools] = useState(INITIAL_TOOLS); // Araç sıralaması
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const minWidth = 64;
    const maxWidth = 200;

    // --- 1. LOCALSTORAGE'DAN YÜKLEME ---
    useEffect(() => {
        const savedOrder = localStorage.getItem("leftPanelToolOrder");
        if (savedOrder) {
            const orderIds = JSON.parse(savedOrder);
            // Kaydedilen ID sırasına göre orijinal listeyi yeniden diziyoruz
            const reorderedTools = orderIds.map((id: string) => 
                INITIAL_TOOLS.find(t => t.id === id)
            ).filter(Boolean);
            
            // Eğer localStorage'da olmayan (yeni eklenmiş) araçlar varsa sonuna ekle
            const missingTools = INITIAL_TOOLS.filter(t => !orderIds.includes(t.id));
            setTools([...reorderedTools, ...missingTools]);
        }
    }, []);

    // --- 2. SIRALAMAYI KAYDETME ---
    const saveOrder = (newTools: typeof INITIAL_TOOLS) => {
        const orderIds = newTools.map(t => t.id);
        localStorage.setItem("leftPanelToolOrder", JSON.stringify(orderIds));
    };

    // --- 3. SÜRÜKLE BIRAK MANTIĞI ---
    const handleDragStart = (index: number) => {
        if (!isEditing) return;
        setDraggedItemIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault(); // Drop'a izin ver
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        // Listeyi anlık olarak güncelle (Görsel geri bildirim)
        const newTools = [...tools];
        const itemToMove = newTools.splice(draggedItemIndex, 1)[0];
        newTools.splice(index, 0, itemToMove);
        
        setDraggedItemIndex(index);
        setTools(newTools);
    };

    const handleDrop = () => {
        setDraggedItemIndex(null);
        saveOrder(tools); // Bırakıldığı an kaydet
    };

    // --- GENİŞLİK AYARLARI ---
    const getGridCols = () => {
        if (width > 160) return 'grid-cols-3';
        if (width > 110) return 'grid-cols-2';
        return 'grid-cols-1';
    };

    const startResizing = (e: React.MouseEvent) => {
        if (!isPinned) return;
        setIsResizing(true);
        e.preventDefault();
    };

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = 'default';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isResizing || !isPinned) return;
        const newWidth = e.clientX; 
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
        }
    }, [isResizing, isPinned]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
            document.body.style.cursor = 'col-resize';
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    return (
        <section 
            style={{ width: isPinned ? `${width}px` : '30px' }}
            className={`flex flex-col relative h-full border-r-2 border-white/20 bg-backg shadow-[20px_0_50px_rgba(0,0,0,0.5)] z-20 overflow-visible 
                ${isResizing ? 'transition-none' : 'transition-[width] duration-300 ease-in-out'}`}
        >
            {/* Genişlik Tutaçı */}
            {isPinned && (
                <div onMouseDown={startResizing} className="absolute -right-2 top-0 w-4 h-full cursor-col-resize z-60 hover:bg-text/10 transition-colors" />
            )}

            {!isPinned && (
                <button onClick={() => setIsPinned(true)} className="absolute inset-y-0 left-0 w-full flex flex-col items-center justify-center gap-4 bg-backg hover:bg-white/5 transition-colors group cursor-pointer border-r border-white/10">
                    <ChevronRight size={14} className="text-text group-hover:scale-125 transition-transform" />
                    <span className="[writing-mode:vertical-lr] text-[10px] rotate-180 font-black tracking-[0.3em] text-texts/40 group-hover:text-text transition-colors uppercase">Araçlar</span>
                    <div className="w-1 h-1 bg-text rounded-full animate-pulse shadow-[0_0_5px_#00ffd5]"></div>
                </button>
            )}

            <div className={`flex flex-col h-full ${!isPinned ? 'invisible opacity-0' : 'visible opacity-100 transition-opacity duration-300 delay-100'}`} style={{ width: `${width}px` }}>
                
                {/* Üst Kontroller */}
                <div className={`grid ${getGridCols()} gap-y-2 gap-x-2 px-2 py-4 mb-2 border-b border-white/5 justify-items-center shrink-0`}>
                    <button onClick={() => setIsPinned(false)} className="p-2 text-text hover:text-white transition-all">
                        <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                    </button>
                    {/* KALEM BUTONU (Düzenleme Modu) */}
                    <button 
                        onClick={() => setIsEditing(!isEditing)} 
                        className={`p-2 transition-all hover:scale-110 ${isEditing ? 'text-text ' : 'text-text/50 hover:text-texts'}`}
                    >
                        <Edit3 size={18} fill={isEditing ? 'currentColor' : 'none'}/>
                    </button>
                </div>

                {/* Araç Izgarası */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                    <div className={`grid ${getGridCols()} gap-y-7 gap-x-2 px-2 justify-items-center transition-all duration-300`}>
                        {tools.map((tool, index) => {
                            const isDisabled = isCanvasEmpty && tool.id !== "handle";
                            return (
                                <div 
                                    key={tool.id}
                                    draggable={isEditing}
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDrop}
                                    className={`relative transition-all duration-300
                                        ${isEditing ? 'cursor-grab active:cursor-grabbing hover:scale-110' : ''} 
                                        ${draggedItemIndex === index ? 'opacity-30 scale-90' : 'opacity-100'}
                                        ${isDisabled ? 'opacity-25 grayscale' : ''}
                                    `}
                                    onClick={() => {
                                        if (isDisabled) {
                                            setSystemMessage({ text: "Sistem: Lütfen Önce Bir Resim Yükleyin!", color: "text-red-500 font-black animate-pulse" });
                                            // 3 saniye sonra geri eski haline çevir
                                            setTimeout(() => {
                                                setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" });
                                            }, 3000);
                                        }
                                    }}
                                >
                                    {/* Sürükleme Modunda Görsel Belirteç */}
                                    {isEditing && (
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-text rounded-full animate-ping pointer-events-none" />
                                    )}
                                    
                                    {/* Araç bileşenine seçim durumunu ve tıklama fonksiyonunu gönderiyoruz */}
                                    <tool.Component 
                                        isActive={activeTool === tool.id}
                                        onClick={() => {
                                            if (!isEditing && !isDisabled) {
                                                setActiveTool(tool.id);
                                            }
                                        }}
                                    />
                                    
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </section>
    );
}