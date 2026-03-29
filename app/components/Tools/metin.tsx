// app/components/Tools/metin.tsx
"use client";

import { FiType } from "react-icons/fi";
import { Move } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
// Tipleri merkezi hook dosyasından çekiyoruz
import { MangaPage, Layer, ToolSettings } from "../hooks/useLayers"; 

// --- ARAÇ ÇUBUĞU BUTONU (Sidebar İkonu) ---
interface MetinProps {
    isActive?: boolean;
    isProcessing?: boolean;
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
                    fontSize: 16, // Başlangıç değeri, auto-fit ile otomatik hesaplanacak
                    color: toolSettings.textColor,    
                    fontFamily: toolSettings.textFont 
                }
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

/**
 * Gizli bir DOM elemanı kullanarak metnin belirli bir font boyutunda
 * belirli bir genişlik/yüksekliğe sığıp sığmadığını ölçer.
 */
function measureTextFit(
    text: string,
    fontFamily: string,
    fontSize: number,
    boxW: number,
    boxH: number
): boolean {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.width = `${boxW - 6}px`; // padding hesabı (3px her tarafa)
    el.style.fontSize = `${fontSize}px`;
    el.style.fontFamily = fontFamily;
    el.style.lineHeight = "1.25";
    el.style.whiteSpace = "pre-wrap";
    el.style.wordBreak = "break-word";
    el.style.padding = "3px";
    el.style.boxSizing = "border-box";
    el.innerText = text || "A"; // Boş metin olursa varsayılan ölçüm
    document.body.appendChild(el);
    const fits = el.scrollHeight <= boxH;
    document.body.removeChild(el);
    return fits;
}

/**
 * Belirli bir kutu boyutu ve metin için sığabilecek maksimum font boyutunu bulur.
 * Binary-search yöntemi kullanır.
 */
function findBestFontSize(
    text: string,
    fontFamily: string,
    boxW: number,
    boxH: number,
    minSize: number = 6,
    maxSize: number = 200
): number {
    if (!text || text.trim().length === 0) return maxSize;
    
    // Üst sınırı kutu yüksekliğiyle kısıtla
    maxSize = Math.min(maxSize, boxH);
    
    let low = minSize;
    let high = maxSize;
    let best = minSize;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (measureTextFit(text, fontFamily, mid, boxW, boxH)) {
            best = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return best;
}

export function TextBox({ layer, isActive, scale, activeTool, onUpdate }: TextBoxProps) {
    const [mode, setMode] = useState<"idle" | "moving" | "resizing">("idle");
    const [resizeDir, setResizeDir] = useState<string>('se');
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState(layer.textConfig);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [autoFontSize, setAutoFontSize] = useState<number>(16);

    // DÜZENLEME KONTROLÜ: Sadece metin aracı seçiliyken işlem yapılabilir
    const isTextTool = activeTool === 'metin';

    // AUTO-FIT: Metin veya kutu boyutu her değiştiğinde otomatik font boyutu hesapla
    useEffect(() => {
        if (!layer.textConfig) return;
        const { w, h, fontFamily } = layer.textConfig as any;
        const bestSize = findBestFontSize(
            layer.text || "",
            fontFamily || "sans-serif",
            w,
            h
        );
        setAutoFontSize(bestSize);
    }, [layer.text, layer.textConfig?.w, layer.textConfig?.h, layer.textConfig?.fontFamily]);

    // Ref for volatile props to avoid recreating mouse listeners on every drag frame
    const volatileProps = useRef({ layer, onUpdate, scale });
    useEffect(() => {
        volatileProps.current = { layer, onUpdate, scale };
    }, [layer, onUpdate, scale]);

    const handleAction = useCallback((e: MouseEvent) => {
        if (mode === "idle" || !isTextTool) return;
        const { layer: currentLayer, onUpdate: currentOnUpdate, scale: currentScale } = volatileProps.current;
        if (!currentLayer.textConfig) return;

        const dx = (e.clientX - startPos.x) / currentScale;
        const dy = (e.clientY - startPos.y) / currentScale;

        if (mode === "moving") {
            currentOnUpdate(currentLayer.id, { 
                ...currentLayer.textConfig, 
                x: (initialRect?.x || 0) + dx, 
                y: (initialRect?.y || 0) + dy 
            }, currentLayer.text || "");
        } else if (mode === "resizing") {
            let { x = 0, y = 0, w = 0, h = 0 } = initialRect || {};

            if (resizeDir.includes('w')) {
                const newX = Math.min(x + dx, x + w - 10);
                w = x + w - newX;
                x = newX;
            } else if (resizeDir.includes('e')) {
                w = Math.max(10, w + dx);
            }
            if (resizeDir.includes('n')) {
                const newY = Math.min(y + dy, y + h - 10);
                h = y + h - newY;
                y = newY;
            } else if (resizeDir.includes('s')) {
                h = Math.max(10, h + dy);
            }

            currentOnUpdate(currentLayer.id, { ...currentLayer.textConfig, x, y, w, h }, currentLayer.text || "");
        }
    }, [mode, resizeDir, startPos, initialRect, isTextTool]);

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
                border: isActive && isTextTool ? '1px solid #00ffd5' : '1px solid transparent',
                zIndex: 200,
                // Metin aracı aktif değilse tıklamaları kutunun altına (canvas'a) geçir
                pointerEvents: isTextTool ? 'auto' : 'none'
            }}
        >
            <textarea
                ref={textareaRef}
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
                    fontSize: `${autoFontSize}px`,
                    color: layer.textConfig.color,
                    fontFamily: (layer.textConfig as any).fontFamily || 'sans-serif',
                    padding: '3px',
                    overflow: 'hidden',
                    lineHeight: '1.25',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                }}
                placeholder={isTextTool ? "Metin girin..." : ""}
                onClick={(e) => e.stopPropagation()}
            />

            {/* Sadece Metin Aracı seçili ve katman aktifse tutaçları göster */}
            {isActive && isTextTool && (
                <>
                    {/* 4 KÖŞE BOYUTLANDIRMA TUTAÇLARI */}
                    {([['nw', {left:'-5px', top:'-5px'}, 'nwse-resize'], ['ne', {right:'-5px', top:'-5px'}, 'nesw-resize'], ['sw', {left:'-5px', bottom:'-5px'}, 'nesw-resize'], ['se', {right:'-5px', bottom:'-5px'}, 'nwse-resize']] as const).map(([dir, pos, cursor]) => (
                        <div
                            key={dir}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setMode("resizing");
                                setResizeDir(dir);
                                setStartPos({ x: e.clientX, y: e.clientY });
                                setInitialRect(layer.textConfig);
                            }}
                            style={{ position: 'absolute', width: '10px', height: '10px', backgroundColor: '#fff', border: '2px solid #00ffd5', borderRadius: '50%', cursor, pointerEvents: 'auto', zIndex: 210, ...pos }}
                        />
                    ))}

                    {/* TAŞIMA BUTONU */}
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
                            bottom: '-40px',
                            transform: 'translateX(-50%)',
                            cursor: mode === 'moving' ? 'grabbing' : 'grab',
                            zIndex: 210
                        }}
                        className="p-1.5 bg-text text-black rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    >
                        <Move size={14} />
                    </div>
                </>
            )}
        </div>
    );
}