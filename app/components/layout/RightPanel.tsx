// app/components/layout/RightPanel.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Pin, Plus, Check, ChevronLeft } from 'lucide-react';
import Toolprops from "../panels/ToolProps";
import Sayfalar from "../panels/Sayfalar";
import Katmanlar from "../panels/katman";

/**
 * TİPLERİ MERKEZİ useLayers'DAN ALIYORUZ
 * MangaPage tipi page.tsx'ten değil, merkezi useLayers.ts dosyasından çekilmelidir.
 */
import { MangaPage, Layer } from "../hooks/useLayers"; 

// Panel Listesi Tanımı (Properties/Özellikler kaldırıldı)
const PANEL_LIST = [
    { id: "tool", label: "Tool Özellikleri", Component: Toolprops },
    { id: "katman", label: "Katmanlar", Component: Katmanlar },
    { id: "sayfa", label: "Sayfalar", Component: Sayfalar },
];

// Page.tsx'ten gelen merkezi veri yönetimi propları
interface RightPanelProps {
    pages: MangaPage[];
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>;
    activePageId: string | null;
    setActivePageId: (id: string) => void;
    onDeletePage: (id: string) => void;
    activeLayerId: string | null;
    setActiveLayerId: (id: string | null) => void;
    
    activeTool: string;
    toolSettings: any;
    setToolSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function Rightpanel({ 
    pages, 
    setPages, 
    activePageId, 
    setActivePageId, 
    onDeletePage,
    activeLayerId,
    setActiveLayerId,
    activeTool,
    toolSettings,
    setToolSettings
}: RightPanelProps) {
    // 1. DURUMLAR VE REFERANSLAR
    const [activePanels, setActivePanels] = useState(["tool", "katman", "sayfa"]);
    const [heights, setHeights] = useState<{ [key: string]: number }>({});
    const [width, setWidth] = useState(340); // Başlangıç genişliği
    const [showMenu, setShowMenu] = useState(false);
    const [isPinned, setIsPinned] = useState(true); 
    const [isResizingWidth, setIsResizingWidth] = useState(false); 
    
    const containerRef = useRef<HTMLDivElement>(null);
    const minHeight = 110; // Panellerin minimum yüksekliği
    const minWidth = 250; 
    const maxWidth = 600; 

    /**
     * YÜKSEKLİK DAĞILIMI (Fix)
     * Panel sayısı değiştiğinde veya uygulama ilk açıldığında alanı 3'e bölüştürür.
     */
    const distributeHeights = useCallback(() => {
        if (containerRef.current && activePanels.length > 0) {
            const totalHeight = containerRef.current.offsetHeight;
            if (totalHeight === 0) return;

            const equalHeight = Math.floor(totalHeight / activePanels.length);
            const newHeights: { [key: string]: number } = {};
            
            activePanels.forEach(id => {
                newHeights[id] = Math.max(minHeight, equalHeight);
            });
            setHeights(newHeights);
        }
    }, [activePanels]);

    // Konteynır boyutu veya panel listesi değiştiğinde yükseklikleri güncelle
    useEffect(() => {
        distributeHeights();
        window.addEventListener('resize', distributeHeights);
        return () => window.removeEventListener('resize', distributeHeights);
    }, [distributeHeights, isPinned]);

    const handleClose = (id: string) => setActivePanels(prev => prev.filter(p => p !== id));

    const handleAdd = (id: string) => {
        if (!activePanels.includes(id)) {
            setActivePanels(prev => [...prev, id].sort((a, b) => 
                PANEL_LIST.findIndex(x => x.id === a) - PANEL_LIST.findIndex(x => x.id === b)
            ));
        }
        setShowMenu(false);
    };

    // --- Yatay Genişlik Değiştirme (Width Resize) ---
    const startResizingWidth = (e: React.MouseEvent) => {
        if (!isPinned) return;
        setIsResizingWidth(true);
        e.preventDefault();
    };

    const handleWidthResize = useCallback((e: MouseEvent) => {
        if (!isResizingWidth || !isPinned) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
        }
    }, [isResizingWidth, isPinned]);

    const stopResizing = useCallback(() => {
        setIsResizingWidth(false);
        document.body.style.cursor = 'default';
    }, []);

    // --- Dikey Yükseklik Değiştirme (Height Resize) ---
    const handleHeightResize = useCallback((id: string, nextId: string, dy: number) => {
        setHeights(prev => {
            const currentH = prev[id] || minHeight;
            const nextH = prev[nextId] || minHeight;
            
            const newUpper = currentH + dy;
            const newLower = nextH - dy;

            if (newUpper >= minHeight && newLower >= minHeight) {
                return { ...prev, [id]: newUpper, [nextId]: newLower };
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        if (isResizingWidth) {
            window.addEventListener("mousemove", handleWidthResize);
            window.addEventListener("mouseup", stopResizing);
            document.body.style.cursor = 'col-resize';
        }
        return () => {
            window.removeEventListener("mousemove", handleWidthResize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizingWidth, handleWidthResize, stopResizing]);

    return (
        <section 
            style={{ width: isPinned ? `${width}px` : '30px' }}
            className={`flex flex-col relative h-full border-l-2 border-white/20 bg-backg transition-[width] duration-300 ${isResizingWidth ? 'transition-none' : 'ease-in-out'} shadow-[-20px_0_50px_rgba(0,0,0,0.5)] overflow-visible z-30`}
        >
            {/* Genişlik Tutaçı */}
            {isPinned && (
                <div 
                    onMouseDown={startResizingWidth}
                    className="absolute -left-1 top-0 w-1 h-full cursor-col-resize z-60 hover:bg-text/20 transition-colors"
                />
            )}

            {/* Kapalı Panel Görünümü */}
            {!isPinned && (
                <button onClick={() => setIsPinned(true)} className="absolute inset-y-0 right-0 w-full flex flex-col items-center justify-center gap-4 bg-backg hover:bg-white/5 transition-colors group cursor-pointer border-l border-white/10">
                    <ChevronLeft size={14} className="text-text group-hover:scale-125 transition-transform" />
                    <div className="w-1 h-1 bg-text rounded-full animate-pulse shadow-[0_0_5px_#00ffd5]"></div>
                    <span className="[writing-mode:vertical-lr] text-[10px] font-black tracking-[0.3em] text-texts/40 group-hover:text-text transition-colors uppercase">Sağ panel</span>
                </button>
            )}

            <div className={`flex flex-col h-full min-h-0 ${!isPinned ? 'invisible opacity-0' : 'visible opacity-100 transition-opacity duration-300'}`} style={{ width: `${width}px` }}>
                <header className="flex shrink-0 items-center justify-between w-full h-8 px-5 bg-white/2 border-b-2 border-white/20 z-50">
                    <button onClick={() => setIsPinned(false)} className="text-text hover:text-white transition-all hover:scale-110">
                        <Pin size={16} fill="currentColor" />
                    </button>
                    <h1 className="text-[10px] font-black uppercase tracking-widest text-texts/80 italic">Paneller</h1>
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="text-text hover:text-white transition-transform active:scale-90">
                            <Plus size={16} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-8 w-48 bg-[#1c1c27] border border-white/10 rounded shadow-2xl py-2 z-50">
                                {PANEL_LIST.map(p => (
                                    <button key={p.id} onClick={() => handleAdd(p.id)} className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors">
                                        {p.label} {activePanels.includes(p.id) && <Check size={12} className="text-text" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                {/* Paneller Konteynırı */}
                <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden min-h-0" onClick={() => setShowMenu(false)}>
                    {activePanels.map((id, index) => {
                        const panel = PANEL_LIST.find(p => p.id === id);
                        if (!panel) return null;
                        const isLast = index === activePanels.length - 1;
                        const nextId = activePanels[index + 1];
                        const Component = panel.Component as React.ComponentType<any>;

                        return (
                            <React.Fragment key={id}>
                                <div 
                                    style={{ 
                                        height: isLast ? undefined : (heights[id] || minHeight), 
                                        flex: isLast ? '1 1 0%' : 'none' 
                                    }} 
                                    className="overflow-hidden border-b-2 border-white/20 last:border-b-0 min-h-0 flex flex-col"
                                >
                                    {id === "sayfa" ? (
                                        <Sayfalar pages={pages} activePageId={activePageId} setActivePageId={setActivePageId} onDeletePage={onDeletePage} onClose={() => handleClose(id)} width={width} />
                                    ) : id === "katman" ? (
                                        <Katmanlar pages={pages} setPages={setPages} activePageId={activePageId} activeLayerId={activeLayerId} setActiveLayerId={setActiveLayerId} onClose={() => handleClose(id)} />
                                    ) : id === "tool" ? (
                                        /* CANLI GÜNCELLEME DESTEĞİ */
                                        <Toolprops 
                                            activeTool={activeTool}
                                            toolSettings={toolSettings}
                                            setToolSettings={setToolSettings}
                                            pages={pages}
                                            setPages={setPages}
                                            activeLayerId={activeLayerId}
                                            onClose={() => handleClose(id)}
                                        />
                                    ) : (
                                        <Component onClose={() => handleClose(id)} />
                                    )}
                                </div>
                                {!isLast && <ResizerHandle onResize={(dy) => handleHeightResize(id, nextId, dy)} />}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// Dikey Yeniden Boyutlandırma Tutaçı
function ResizerHandle({ onResize }: { onResize: (dy: number) => void }) {
    const [isDragging, setIsDragging] = useState(false);
    
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => { if (isDragging) onResize(e.movementY); };
        const onMouseUp = () => { setIsDragging(false); document.body.style.cursor = 'default'; };
        
        if (isDragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [isDragging, onResize]);

    return <div onMouseDown={onMouseDown} className="h-1 w-full cursor-row-resize z-40 transition-colors shrink-0 bg-white/2 hover:bg-text/40 active:bg-text" />;
}