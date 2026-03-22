"use client";

import { FiType } from "react-icons/fi";
import { Move, Maximize2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
// Tipleri merkezi hook dosyasından çekiyoruz
import { MangaPage, Layer, ToolSettings } from "../hooks/useLayers"; 

// --- ARAÇ ÇUBUĞU BUTONU (Sidebar İkonu) ---
interface MetinProps {
    isActive?: boolean;
    onClick?: () => void;
}

export default function Metin({ isActive, onClick }: MetinProps) {
    return (
        <section>
            <button
                onClick={onClick}
                className={`p-2 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-text text-black shadow-[0_0_15px_rgba(0,255,213,0.4)] scale-110'
                        : 'text-texts/50 hover:text-texts hover:bg-white/5'
                    }`}
                title="Metin Aracı (T)"
            >
                <FiType size={18} />
            </button>
        </section>
    );
}

/**
 * --- METİN HOOK'U ---
 * Tuval üzerinde yeni metin kutusu oluşturma lojiğini yönetir.
 */
export function useText(
    activePageId: string | null, 
    pages: MangaPage[], 
    setPages: React.Dispatch<React.SetStateAction<MangaPage[]>>,
    setActiveLayerId: (id: string | null) => void,
    toolSettings: ToolSettings 
) {
    const [textStart, setTextStart] = useState<{ x: number, y: number } | null>(null);
    const [currentTextRect, setCurrentTextRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const startText = (coords: { x: number, y: number }) => {
        setTextStart(coords);
    };

    const moveText = (coords: { x: number, y: number }) => {
        if (!textStart) return;
        setCurrentTextRect({
            x: Math.min(coords.x, textStart.x),
            y: Math.min(coords.y, textStart.y),
            w: Math.abs(coords.x - textStart.x),
            h: Math.abs(coords.y - textStart.y)
        });
    };

    const endText = () => {
        if (currentTextRect && currentTextRect.w > 10 && currentTextRect.h > 10 && activePageId) {
            const activePage = pages.find(p => p.id === activePageId);
            const textCount = activePage?.layers.filter(l => l.text !== undefined).length || 0;

            const newId = `text-${Date.now()}`; 
            
            // Yeni katman oluşturulurken ToolSettings üzerindeki güncel font ve renk ayarları kullanılır
            const newLayer: Layer = {
                id: newId,
                name: `Metin ${textCount + 1}`,
                isVisible: true,
                text: "", 
                textConfig: { 
                    x: currentTextRect.x, 
                    y: currentTextRect.y, 
                    w: currentTextRect.w, 
                    h: currentTextRect.h, 
                    fontSize: toolSettings.textSize, 
                    color: toolSettings.textColor,    
                    fontFamily: toolSettings.textFont 
                } as any // fontFamily tipi useLayers.ts'de henüz tanımlanmamış olabilir
            };

            setPages(prev => prev.map(p => 
                p.id === activePageId ? { ...p, layers: [newLayer, ...p.layers] } : p
            ));

            setActiveLayerId(newId);
        }
        setTextStart(null);
        setCurrentTextRect(null);
    };

    return {
        startText,
        moveText,
        endText,
        drawingText: currentTextRect
    };
}

// --- TUVAL ÜZERİNDEKİ METİN KUTUSU BİLEŞENİ ---
interface TextBoxProps {
    layer: Layer;
    isActive: boolean;
    scale: number;
    activeTool: string; // Kutunun aktif araçla olan ilişkisini kontrol etmek için eklendi
    onUpdate: (id: string, config: any, content: string) => void;
}

export function TextBox({ layer, isActive, scale, activeTool, onUpdate }: TextBoxProps) {
    const [mode, setMode] = useState<"idle" | "moving" | "resizing">("idle");
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState(layer.textConfig);

    // DÜZENLEME KONTROLÜ: Sadece metin aracı seçiliyken işlem yapılabilir
    const isTextTool = activeTool === 'metin';

    const handleAction = useCallback((e: MouseEvent) => {
        if (mode === "idle" || !layer.textConfig || !isTextTool) return;

        const dx = (e.clientX - startPos.x) / scale;
        const dy = (e.clientY - startPos.y) / scale;

        if (mode === "moving") {
            onUpdate(layer.id, { 
                ...layer.textConfig, 
                x: (initialRect?.x || 0) + dx, 
                y: (initialRect?.y || 0) + dy 
            }, layer.text || "");
        } else if (mode === "resizing") {
            onUpdate(layer.id, { 
                ...layer.textConfig, 
                w: Math.max(30, (initialRect?.w || 0) + dx), 
                h: Math.max(30, (initialRect?.h || 0) + dy) 
            }, layer.text || "");
        }
    }, [mode, startPos, initialRect, scale, layer, onUpdate, isTextTool]);

    useEffect(() => {
        const handleGlobalMouseUp = () => setMode("idle");
        if (mode !== "idle") {
            window.addEventListener("mousemove", handleAction);
            window.addEventListener("mouseup", handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleAction);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
        };
    }, [mode, handleAction]);

    if (!layer.textConfig) return null;

    return (
        <div 
            style={{
                position: 'absolute',
                left: `${layer.textConfig.x}px`,
                top: `${layer.textConfig.y}px`,
                width: `${layer.textConfig.w}px`,
                height: `${layer.textConfig.h}px`,
                border: isActive && isTextTool ? '1px solid #00ffd5' : '1px transparent',
                zIndex: 200,
                // Metin aracı aktif değilse tıklamaları kutunun altına (canvas'a) geçir
                pointerEvents: isTextTool ? 'auto' : 'none' 
            }}
        >
            <textarea
                value={layer.text}
                onChange={(e) => onUpdate(layer.id, layer.textConfig!, e.target.value)}
                // Metin aracı seçili değilse içeriği değiştirilemez yap
                readOnly={!isTextTool} 
                style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    resize: 'none',
                    outline: 'none',
                    fontSize: `${layer.textConfig.fontSize}px`,
                    color: layer.textConfig.color,
                    fontFamily: (layer.textConfig as any).fontFamily || 'sans-serif',
                    padding: '5px',
                    overflow: 'hidden',
                    lineHeight: '1.2'
                }}
                placeholder={isTextTool ? "Metin girin..." : ""}
                onClick={(e) => e.stopPropagation()}
            />

            {/* Sadece Metin Aracı seçili ve katman aktifse tutaçları göster */}
            {isActive && isTextTool && (
                <>
                    {/* TAŞIMA TUTAÇI */}
                    <div 
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setMode("moving");
                            setStartPos({ x: e.clientX, y: e.clientY });
                            setInitialRect(layer.textConfig);
                        }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: '-35px',
                            transform: 'translateX(-50%)',
                            cursor: mode === 'moving' ? 'grabbing' : 'grab'
                        }}
                        className="p-1.5 bg-text text-black rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    >
                        <Move size={14} />
                    </div>

                    {/* BOYUTLANDIRMA TUTAÇI */}
                    <div 
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setMode("resizing");
                            setStartPos({ x: e.clientX, y: e.clientY });
                            setInitialRect(layer.textConfig);
                        }}
                        style={{
                            position: 'absolute',
                            right: '-5px',
                            bottom: '-5px',
                            cursor: 'nwse-resize'
                        }}
                        className="p-1 bg-white text-black rounded-sm shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                    >
                        <Maximize2 size={10} />
                    </div>
                </>
            )}
        </div>
    );
}