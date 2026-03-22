"use client";
import { useState, useEffect, useCallback } from "react";

export function useZoom() {
    const [scale, setScale] = useState(1);
    const minScale = 0.1;
    const maxScale = 5.0;

    const handleWheel = useCallback((e: React.WheelEvent) => {
        // Hassas bir zoom için deltaY değerini küçük bir katsayı ile çarpıyoruz
        const zoomStep = 0.1;
        const delta = e.deltaY > 0 ? -zoomStep : zoomStep;

        setScale((prevScale) => {
            const newScale = prevScale + delta;
            // Belirlediğimiz sınırlar dışına çıkmasını engelliyoruz
            return Math.min(Math.max(newScale, minScale), maxScale);
        });
    }, []);

    // Zoom değerini % olarak döndüren yardımcı fonksiyon
    const zoomPercent = Math.round(scale * 100);

    return { scale, handleWheel, zoomPercent };
}