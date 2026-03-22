import Link from "next/link";
import { Settings, HelpCircle, RotateCcw, RotateCw } from "lucide-react";

interface HeaderProps {
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
}

export default function Header({ canUndo = false, canRedo = false, onUndo, onRedo }: HeaderProps) {
    return (
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-white/5 bg-backg px-6 relative gap-4">
            
            {/* SOL: Logo + Undo/Redo */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 pr-4 border-r border-white/7">
                    <div className="h-7 w-7 rounded-lg bg-text flex items-center justify-center shadow-[0_0_14px_rgba(0,255,213,0.3)] shrink-0">
                        <span className="text-black font-black text-sm italic">D</span>
                    </div>
                    <span className="font-black tracking-[0.18em] text-text text-[11px] italic uppercase">Doxmaxima</span>
                </div>

                <div className="flex items-center gap-0.5 pl-1">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Geri Al (Ctrl+Z)"
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all
                            ${canUndo ? 'text-texts/40 hover:bg-text/10 hover:text-text' : 'text-texts/15 cursor-not-allowed'}`}
                    >
                        <RotateCcw size={13} />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="İleri Al (Ctrl+Y)"
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all
                            ${canRedo ? 'text-texts/40 hover:bg-text/10 hover:text-text' : 'text-texts/15 cursor-not-allowed'}`}
                    >
                        <RotateCw size={13} />
                    </button>
                </div>
            </div>

            {/* ORTA: Proje adı */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/3 border border-white/6 rounded-lg px-3 h-7.5">
                <div className="w-1.25 h-1.25 rounded-full bg-text shadow-[0_0_6px_rgba(0,255,213,0.8)]" />
                <span className="text-[11px] font-bold text-texts/50 uppercase tracking-widest whitespace-nowrap">
                    Manga Çeviri Editörü
                </span>
            </div>

            {/* SAĞ: Nav */}
            <nav className="flex items-center gap-1">
                <Link
                    href="/settings"
                    className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-bold uppercase tracking-[0.08em] text-texts/30 hover:bg-text/6 hover:text-text transition-all"
                >
                    <Settings size={13} /> Ayarlar
                </Link>
                <Link
                    href="/guide"
                    className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-bold uppercase tracking-[0.08em] text-texts/30 hover:bg-text/6 hover:text-text transition-all"
                >
                    <HelpCircle size={13} /> Rehber
                </Link>
            </nav>

            {/* Alt Neon Çizgi */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-text/40 to-transparent" />
        </header>
    );
}