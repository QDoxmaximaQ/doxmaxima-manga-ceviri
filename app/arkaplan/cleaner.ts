// app/arkaplan/cleaner.ts
import { MangaPage, Layer } from "../components/hooks/useLayers";
import { calcDisplaySize, getOriginalDimensions } from "../utils/displaySize";
import { processWithLama } from "./lama";

/**
 * Manga sayfasındaki tüm seçim alanlarını parça parça AI ile temizler.
 * Mor alanlar (yazı bounding box + 2px) silinir, 
 * Mavi alanlar (padding) AI'ya bağlam olarak verilir ancak sayfaya eklenmez.
 */
export async function cleanPageBackground(
    page: MangaPage,
    setSystemMessage: (msg: { text: string, color: string }) => void,
    setIsProcessing: (val: boolean) => void
): Promise<string | null> {
    if (!page.url) return null;

    const selectionLayers = page.layers.filter(l => l.selection && l.isVisible && l.lines);
    if (selectionLayers.length === 0) {
        setSystemMessage({ text: "Sistem: Temizlenecek analiz edilmiş alan bulunamadı.", color: "text-orange-500" });
        return null;
    }

    try {
        setIsProcessing(true);
        setSystemMessage({ text: `Sistem: Sayfadaki ${selectionLayers.length} ocr alanı tek seferde temizleniyor...`, color: "text-blue-400" });

        // Ölçek hesaplamaları
        const origDimensions = await getOriginalDimensions(page.url);
        const { displayW, displayH } = calcDisplaySize(origDimensions.w, origDimensions.h);
        const scaleX = displayW / origDimensions.w;
        const scaleY = displayH / origDimensions.h;

        // Tüm hedef (mor) kutuları tek bir dizide topluyoruz
        const targetBoxes = [];
        
        for (const layer of selectionLayers) {
            const purpleBox = calculatePurpleBox(layer);
            if (purpleBox) targetBoxes.push(purpleBox);
        }

        if (targetBoxes.length === 0) {
            return null;
        }

        // Tek seferde tüm maskeleri API'ye gönderiyoruz (Kotadan ve zamandan tasarruf)
        const resultUrl = await processWithLama(page.url, [], targetBoxes, scaleX, scaleY);

        setSystemMessage({ text: "Sistem: Tüm Alanların Temizlenmesi Tamamlandı!", color: "text-[#00ffd5]" });
        return resultUrl;

    } catch (error: any) {
        console.error("[Cleaner] Hata:", error);
        setSystemMessage({ text: `Hata: ${error.message || "Bilinmiyor"}`, color: "text-red-500 font-bold" });
        return null;
    } finally {
        setIsProcessing(false);
    }
}

/**
 * Yazı çizgilerine göre mor kutuyu hesaplar (+2px padding)
 */
function calculatePurpleBox(layer: Layer) {
    if (!layer.lines || layer.lines.length === 0 || !layer.selection) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    layer.lines.forEach(line => {
        const lx = layer.selection!.x + line.relX;
        const ly = layer.selection!.y + line.relY;
        const lw = line.w;
        const lh = line.h;

        minX = Math.min(minX, lx);
        minY = Math.min(minY, ly);
        maxX = Math.max(maxX, lx + lw);
        maxY = Math.max(maxY, ly + lh);
    });

    // 2px genişlet
    const PADDING = 2;
    return {
        x: minX - PADDING,
        y: minY - PADDING,
        w: (maxX - minX) + PADDING * 2,
        h: (maxY - minY) + PADDING * 2
    };
}

/**
 * Bağlam padding hesaplaması (Overlap kontrolü ile - Mavi Alan)
 */
function calculateBlueBox(
    layer: Layer, 
    purpleBox: {x: number, y: number, w: number, h: number}, 
    allSelections: any[]
) {
    const IDEAL_PADDING = 50;
    let padLeft = IDEAL_PADDING, padTop = IDEAL_PADDING, padRight = IDEAL_PADDING, padBottom = IDEAL_PADDING;

    for (const other of allSelections) {
        if (other.id === layer.id) continue;

        // Diğer seçimin ana alanı (mor alanı) ile çakışmayı önle
        const oL = other.x, oT = other.y, oR = other.x + other.w, oB = other.y + other.h;

        // Basit overlap kontrolü
        const hasVerticalOverlap = !(oB <= purpleBox.y || oT >= purpleBox.y + purpleBox.h);
        const hasHorizontalOverlap = !(oR <= purpleBox.x || oL >= purpleBox.x + purpleBox.w);

        if (hasVerticalOverlap) {
            if (oR > purpleBox.x - IDEAL_PADDING && oR <= purpleBox.x) padLeft = Math.min(padLeft, Math.max(0, purpleBox.x - oR));
            if (oL < purpleBox.x + purpleBox.w + IDEAL_PADDING && oL >= purpleBox.x + purpleBox.w) padRight = Math.min(padRight, Math.max(0, oL - (purpleBox.x + purpleBox.w)));
        }
        if (hasHorizontalOverlap) {
            if (oB > purpleBox.y - IDEAL_PADDING && oB <= purpleBox.y) padTop = Math.min(padTop, Math.max(0, purpleBox.y - oB));
            if (oT < purpleBox.y + purpleBox.h + IDEAL_PADDING && oT >= purpleBox.y + purpleBox.h) padBottom = Math.min(padBottom, Math.max(0, oT - (purpleBox.y + purpleBox.h)));
        }
    }

    return {
        x: purpleBox.x - padLeft,
        y: purpleBox.y - padTop,
        w: purpleBox.w + padLeft + padRight,
        h: purpleBox.h + padTop + padBottom
    };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Resim yüklenemedi: " + src));
        img.src = src;
    });
}
