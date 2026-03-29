// app/utils/displaySize.ts
// Merkezi görüntüleme boyutu hesaplama fonksiyonu
// Canvas, OtoSecme ve ToolProps bu fonksiyonu kullanır

const BASE_W = 840;
const BASE_H = 1200;

/**
 * Orijinal resim boyutundan canvas display boyutunu hesaplar.
 * Portre/kare resimlerde yükseklik 1200px'e sabitlenip genişlik oranlanır.
 * Yatay resimlerde genişlik 840px'e sabitlenip yükseklik oranlanır.
 */
export function calcDisplaySize(origW: number, origH: number) {
    if (origH >= origW) {
        return {
            displayW: Math.round(BASE_H * (origW / origH)),
            displayH: BASE_H
        };
    } else {
        return {
            displayW: BASE_W,
            displayH: Math.round(BASE_W * (origH / origW))
        };
    }
}

/**
 * Orijinal resim boyutlarını Promise ile alır.
 * Resim yüklenemezse varsayılan 840x1200 döner.
 */
export function getOriginalDimensions(url: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => {
            console.warn("Resim boyutu alınamadı, 1:1 ölçek kullanılıyor.");
            resolve({ w: BASE_W, h: BASE_H });
        };
        img.src = url;
    });
}
