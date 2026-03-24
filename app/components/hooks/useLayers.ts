// app/components/hooks/useLayers.ts
"use client";

import { useState, useCallback } from 'react';

/** * --- MERKEZİ TİP TANIMLARI ---
 * Bu tipler tüm editör genelinde (Fırça, Silgi, Metin, Canvas) ortak kullanılır.
 */

export interface ToolSettings {
    brushSize: number;
    brushColor: string;
    brushOpacity: number;
    brushHardness: number;
    eraserSize: number;
    eraserOpacity: number;
    eraserHardness: number;
    // --- Metin Ayarları ---
    textSize: number;
    textColor: string;
    textFont: string;
}

export interface Layer {
    id: string;
    name: string;
    isVisible: boolean;
    isBase?: boolean;
    dataURL?: string; // Fırça ve Silgi çizimleri için
    selection?: {
        x: number;
        y: number;
        w: number;
        h: number;
    }; // Seçme aracı için

    // --- Metin Desteği (Metin Aracı için) ---
    text?: string; // Yazılan metin içeriği
    textConfig?: {
        x: number;
        y: number;
        w: number;
        h: number;
        fontSize: number;
        color: string;
        fontFamily: string; // Yazı tipi desteği eklendi
    };
}

export interface MangaPage {
    id: string;
    url: string;
    name: string;
    layers: Layer[];
}

/**
 * useLayers Hook'u: Projenin Operasyon Merkezi
 * Tüm sayfa ve katman durumlarını (state) tek bir noktadan yönetir.
 */
export function useLayers() {
    const [pages, setPages] = useState<MangaPage[]>([]);
    const [history, setHistory] = useState<MangaPage[][]>([]); // ← ekle
    const [future, setFuture] = useState<MangaPage[][]>([]);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    // Aktif sayfa bilgisini türetilmiş bir değer olarak alıyoruz
    const activePage = pages.find(p => p.id === activePageId);

    const pushHistory = useCallback(() => {
        setHistory(prev => [...prev.slice(-20), pages]);
        setFuture([]);
    }, [pages]);

    const undo = useCallback(() => {
        if (history.length === 0) return;
        setFuture(prev => [pages, ...prev]);
        setPages(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
    }, [history, pages]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        setHistory(prev => [...prev, pages]);
        setPages(future[0]);
        setFuture(prev => prev.slice(1));
    }, [future, pages]);

    // --- SAYFA YÖNETİMİ ---

    // Yeni sayfaları listeye ekleme
    const addPages = useCallback((urls: string[]) => {
        setPages(prev => {
            const timestamp = Date.now();
            const newPages = urls.map((url, index) => {
                const pageId = `page-${timestamp}-${index}`;
                return {
                    id: pageId,
                    url: url,
                    name: `Sayfa ${prev.length + index + 1}`,
                    layers: [{
                        id: `layer-${Date.now()}-${index}`,
                        name: "Ana Katman",
                        isVisible: true,
                        isBase: true,
                        dataURL: url
                    }]
                };
            });
            const updated = [...prev, ...newPages];

            // Eğer aktif sayfa yoksa ilk yüklenen sayfayı aktif yap
            if (!activePageId && updated.length > 0) {
                setActivePageId(updated[0].id);
                setActiveLayerId(updated[0].layers[0].id);
            }
            return updated;
        });
    }, [activePageId]);

    // Sayfayı silme lojiği
    const deletePage = useCallback((id: string) => {
        setPages(prev => {
            const filtered = prev.filter(p => p.id !== id);
            // Silinen sayfa aktifse, odağı değiştir
            if (activePageId === id) {
                setActivePageId(filtered.length > 0 ? filtered[0].id : null);
            }
            return filtered;
        });
    }, [activePageId]);

    // Sayfa seçildiğinde otomatik olarak o sayfanın ilk katmanını da aktif yapar
    const selectPage = useCallback((id: string | null) => {
        setActivePageId(id);
        const targetPage = pages.find(p => p.id === id);
        if (targetPage && targetPage.layers.length > 0) {
            setActiveLayerId(targetPage.layers[0].id);
        }
    }, [pages]);

    // --- KATMAN YÖNETİMİ ---

    // Aktif sayfaya yeni bir boş çizim katmanı ekleme
    const addLayer = useCallback(() => {
        if (!activePageId) return;
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                const newLayer: Layer = {
                    id: `layer-${Date.now()}`,
                    name: `Katman ${page.layers.length + 1}`,
                    isVisible: true
                };
                setActiveLayerId(newLayer.id);
                // Yeni katmanı her zaman listenin en başına (en üste) ekler
                return { ...page, layers: [newLayer, ...page.layers] };
            }
            return page;
        }));
    }, [activePageId]);

    // Katman ismini yeniden adlandırma
    const renameLayer = useCallback((layerId: string, newName: string) => {
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                return {
                    ...page,
                    layers: page.layers.map(l => l.id === layerId ? { ...l, name: newName } : l)
                };
            }
            return page;
        }));
    }, [activePageId]);

    // Katman görünürlüğünü (göz ikonu) değiştirme
    const toggleLayer = useCallback((layerId: string) => {
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                return {
                    ...page,
                    layers: page.layers.map(l => l.id === layerId ? { ...l, isVisible: !l.isVisible } : l)
                };
            }
            return page;
        }));
    }, [activePageId]);

    // Katman silme (Ana Katman korumalı)
    const deleteLayer = useCallback((layerId: string) => {
        if (!activePage) return;
        const layerToDelete = activePage.layers.find(l => l.id === layerId);

        // Güvenlik: Ana katmanın silinmesini engeller
        if (layerToDelete?.isBase) return;

        setPages(prev => prev.map(page => {
            if (page.id === activePageId) {
                const filtered = page.layers.filter(l => l.id !== layerId);
                // Silinen katman aktifse, odağı listedeki mevcut bir katmana kaydır
                if (activeLayerId === layerId) {
                    setActiveLayerId(filtered.length > 0 ? filtered[0].id : null);
                }
                return { ...page, layers: filtered };
            }
            return page;
        }));
    }, [activePage, activePageId, activeLayerId]);

    // Katmanları sürükle-bırak sonrası yeniden sıralama
    const reorderLayers = useCallback((newLayers: Layer[]) => {
        setPages(prev => prev.map(page => {
            if (page.id === activePageId) return { ...page, layers: newLayers };
            return page;
        }));
    }, [activePageId]);

    return {
        pages,
        setPages,
        pushHistory,
        undo,
        redo,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        activePageId,
        activeLayerId,
        setActiveLayerId,
        activePage,
        addPages,
        deletePage,
        selectPage,
        addLayer,
        renameLayer,
        toggleLayer,
        deleteLayer,
        reorderLayers
    };
}