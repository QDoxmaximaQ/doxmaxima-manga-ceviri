// app/components/panels/katman.tsx
"use client";
import React, { useState } from "react";
import { Layers, Eye, EyeOff, Trash2, Plus, CircleX, GripVertical, Square } from 'lucide-react';
import { Layer, MangaPage } from "../hooks/useLayers"; // Projenizdeki dosya yoluna göre gerekirse "../page" yapın

// RightPanel.tsx tarafından geçilen proplar
interface KatmanlarProps {
    pages: MangaPage[];
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>;
    activePageId: string | null;
    activeLayerId: string | null;
    setActiveLayerId: (id: string | null) => void;
    onClose?: () => void;
}

export default function Katmanlar({
    pages,
    setPages,
    activePageId,
    activeLayerId,
    setActiveLayerId,
    onClose
}: KatmanlarProps) {

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Aktif sayfanın katmanlarını buluyoruz
    const activePage = pages.find(p => p.id === activePageId);
    const currentLayers = activePage?.layers || [];

    // --- KATMAN FONKSİYONLARI (TÜM LOJİK BURADA) ---

    // Yeni Boş Çizim Katmanı Ekleme
    const handleAddLayer = () => {
        if (!activePageId) return;
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                const newLayer = {
                    id: `layer-${Date.now()}`,
                    name: `Katman ${page.layers.length + 1}`,
                    isVisible: true
                };
                setActiveLayerId(newLayer.id);
                // Yeni katmanı listenin en üstüne (ön plana) ekler
                return { ...page, layers: [newLayer, ...page.layers] };
            }
            return page;
        }));
    };

    // İsim Değiştirme
    const handleRenameLayer = (layerId: string, newName: string) => {
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                return {
                    ...page,
                    layers: page.layers.map(l => l.id === layerId ? { ...l, name: newName } : l)
                };
            }
            return page;
        }));
    };

    // Görünürlük Aç/Kapat
    const handleToggleLayer = (layerId: string) => {
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                return {
                    ...page,
                    layers: page.layers.map(l => l.id === layerId ? { ...l, isVisible: !l.isVisible } : l)
                };
            }
            return page;
        }));
    };

    // Katman Silme (Ana Katman Korumalı)
    const handleDeleteLayer = (layerId: string) => {
        const layerToDelete = currentLayers.find(l => l.id === layerId);

        // Ana Katman silinme koruması
        if (layerToDelete?.isBase) {
            alert("Ana Katman silinemez!");
            return;
        }
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                const filteredLayers = page.layers.filter(l => l.id !== layerId);
                // Silinen katman aktifse, odağı listedeki bir sonraki katmana kaydır
                if (activeLayerId === layerId) {
                    setActiveLayerId(filteredLayers.length > 0 ? filteredLayers[0].id : null);
                }
                return { ...page, layers: filteredLayers };
            }
            return page;
        }));
    };

    // Sürükle-Bırak Sıralama
    const handleReorder = (dragIndex: number, hoverIndex: number) => {
        if (dragIndex === hoverIndex) return;

        const newLayers = [...currentLayers];
        const draggedItem = newLayers[dragIndex];
        newLayers.splice(dragIndex, 1);
        newLayers.splice(hoverIndex, 0, draggedItem);

        setPages(prev => prev.map(page => {
            if (page.id === activePageId) return { ...page, layers: newLayers };
            return page;
        }));
    };

    return (
        <div className="flex flex-col h-full bg-backg overflow-hidden">
            {/* BAŞLIK (HEADER) */}
            <div className="flex h-9 shrink-0 items-center justify-between px-4 bg-white/2 border-b border-white/10 z-10">
                <div className="flex items-center gap-2 text-text">
                    <Layers size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        Katmanlar ({currentLayers.length})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAddLayer}
                        className="text-text hover:text-white transition-colors p-1"
                        title="Yeni Katman Ekle"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="text-texts/30 hover:text-red-500 transition-colors p-1"
                    >
                        <CircleX size={14} />
                    </button>
                </div>
            </div>

            {/* KATMAN LİSTESİ */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-1 content-start shadow-inner">
                {currentLayers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-10">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-center">Sayfa Seçilmedi veya Katman Yok</p>
                    </div>
                ) : (
                    currentLayers.map((layer, index) => (
                        <div
                            key={layer.id}
                            draggable
                            onDragStart={() => setDraggedIndex(index)}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (draggedIndex !== null && draggedIndex !== index) {
                                    handleReorder(draggedIndex, index);
                                    setDraggedIndex(index);
                                }
                            }}
                            onDragEnd={() => setDraggedIndex(null)}
                            onClick={() => setActiveLayerId(layer.id)}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded border transition-all cursor-pointer
                                ${activeLayerId === layer.id
                                    ? 'bg-text/10 border-text/30 shadow-[inset_0_0_10px_rgba(0,255,213,0.05)]'
                                    : 'bg-white/2 border-white/5 hover:border-white/10'}
                                ${draggedIndex === index ? 'opacity-40 border-dashed border-text scale-[0.98]' : ''}`}
                        >
                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                {/* Sürükleme Tutaçı */}
                                <GripVertical size={12} className="text-texts/20 cursor-grab active:cursor-grabbing shrink-0" />

                                {/* Görünürlük Butonu */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleLayer(layer.id); }}
                                    className={`${layer.isVisible ? 'text-text' : 'text-texts/20'} hover:scale-110 transition-transform shrink-0`}
                                >
                                    {layer.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>

                                {/* SEÇİLİ ALAN İKONU:
                                    Eğer katman bir seçim alanıysa, ismin yanında kare ikonu gösterir.
                                */}
                                {layer.selection && (
                                    <Square size={12} className="text-purple-400 shrink-0" />
                                )}

                                {/* İsim / Düzenleme Alanı */}
                                {editingId === layer.id ? (
                                    <input
                                        autoFocus
                                        className="bg-black/40 border border-text/50 text-[10px] font-bold px-1 rounded w-full outline-none text-text"
                                        value={layer.name}
                                        onChange={(e) => handleRenameLayer(layer.id, e.target.value)}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                                    />
                                ) : (
                                    <span
                                        onDoubleClick={() => setEditingId(layer.id)}
                                        className={`text-[10px] font-bold truncate tracking-wide select-none flex-1 ${!layer.isVisible && 'opacity-30 italic'}`}
                                    >
                                        {layer.name}
                                    </span>
                                )}
                            </div>

                            {/* Silme Butonu - ANA KATMAN KORUMASI */}
                            {!layer.isBase && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }}
                                    className="text-texts/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 shrink-0"
                                    title="Katmanı Sil"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}