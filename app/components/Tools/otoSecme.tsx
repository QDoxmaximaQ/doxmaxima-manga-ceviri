"use client";

import { FaRobot } from "react-icons/fa6";
import React from "react";
// Tipleri merkezi hook dosyasından çekiyoruz
import { MangaPage } from "../hooks/useLayers";

/**
 * --- ARAÇ ÇUBUĞU BUTONU (Sidebar İkonu) ---
 * Sol panelde AI aracını temsil eden buton bileşeni.
 */
interface OtosecmeProps {
    isActive?: boolean;
    onClick?: () => void;
}

export default function Otosecme({ isActive, onClick }: OtosecmeProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Otoseçme Aracı (R)"
            >
                <FaRobot size={18} />
            </button>
        </section>
    );
}

/**
 * --- OTO SEÇME (AI) HOOK'U ---
 * Tuval üzerinde 'otosecme' aracı seçiliyken tıklandığında Python API'sini tetikler.
 * @param setIsProcessing: page.tsx üzerindeki yükleme ekranını (overlay) kontrol eder.
 */
export function useAutoSelection(
    activePageId: string | null,
    pages: MangaPage[],
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setIsProcessing: (val: boolean) => void
) {
    const triggerAI = async () => {
        const activePage = pages.find(p => p.id === activePageId);
        if (!activePage) return;

        // İşlem başladığında ekranı kilitle ve loading göster
        setIsProcessing(true); 
        
        try {
            // 1. Mevcut sayfanın görüntüsünü Blob formatına çevir
            const response = await fetch(activePage.url);
            const blob = await response.blob();
            
            // --- GÜNCELLEME: DİNAMİK UZANTI TESPİTİ ---
            // AVIF gibi formatların Python/Pillow tarafında 'cannot identify' hatası vermemesi için
            // blob tipinden gerçek uzantıyı alıyoruz.
            const extension = blob.type.split('/')[1] || 'png';
            const filename = `manga_page.${extension}`;
            
            // 2. Python API'sine gönderilecek FormData'yı hazırla
            const formData = new FormData();
            formData.append('file', blob, filename);

            // 3. Python Sunucusuna (main.py) isteği gönder
            const apiRes = await fetch('http://localhost:8000/auto-process', {
                method: 'POST',
                body: formData,
            });

            if (!apiRes.ok) throw new Error("Python sunucusu yanıt vermedi.");

            const result = await apiRes.json();

            if (result.status === "success") {
                // 4. API'den gelen verileri sayfaya işle
                setPages(prev => prev.map(page => {
                    if (page.id === activePageId) {
                        return {
                            ...page,
                            // Arka plan resmini AI'nın temizlediği resimle değiştir
                            url: result.cleaned_image_url, 
                            // AI'dan gelen yeni metin katmanlarını mevcut katmanların üzerine ekle
                            layers: [...result.layers, ...page.layers]
                        };
                    }
                    return page;
                }));
            } else if (result.status === "error") {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error("AI Hook Hatası:", error);
            alert(`AI İşlemi başarısız oldu: ${error.message || 'Sunucu hatası'}`);
        } finally {
            // İşlem bitince yükleme ekranını kapat
            setIsProcessing(false); 
        }
    };

    return { triggerAI };
}