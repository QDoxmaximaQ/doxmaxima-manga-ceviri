// app/settings/page.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Save,
  Key,
  Languages,
  Terminal,
  Cpu,
  Settings2,
  ChevronDown,
  Layers,
  ShieldCheck,
  Image,
  ScanSearch
} from 'lucide-react';
import { OcrEngines, getLanguagesForEngine } from '../ocr/Ocr_model';

export default function SettingsPage() {
  const [isSaved, setIsSaved] = useState(false);
  const [ocrEngine, setOcrEngine] = useState<string>("ocrspace");
  const [ocrspaceKey, setOcrspaceKey] = useState<string>("");
  const [ocrspaceLang, setOcrspaceLang] = useState<string>("eng");
  const [paddleOcrUrl, setPaddleOcrUrl] = useState<string>("");
  const [paddleOcrLang, setPaddleOcrLang] = useState<string>("en");
  const [easyOcrUrl, setEasyOcrUrl] = useState<string>("Doxmaxima/EasyOCR-v1");
  const [easyOcrLang, setEasyOcrLang] = useState<string>("latin");

  useEffect(() => {
    const savedOcr = localStorage.getItem("ocrEngine");
    if (savedOcr) {
      setOcrEngine(savedOcr);
    }
    const savedOcrSpace = localStorage.getItem("ocrspaceApiKey");
    if (savedOcrSpace) setOcrspaceKey(savedOcrSpace);

    const savedPaddleOcr = localStorage.getItem("paddleOcrUrl");
    if (savedPaddleOcr) setPaddleOcrUrl(savedPaddleOcr);

    const savedPaddleLang = localStorage.getItem("paddleOcrLang");
    if (savedPaddleLang) setPaddleOcrLang(savedPaddleLang);

    const savedEasyOcrUrl = localStorage.getItem("easyOcrUrl");
    if (savedEasyOcrUrl) setEasyOcrUrl(savedEasyOcrUrl);

    const savedEasyOcrLang = localStorage.getItem("easyOcrLang");
    if (savedEasyOcrLang) setEasyOcrLang(savedEasyOcrLang);

    const savedOcrspaceLang = localStorage.getItem("ocrspaceLang");
    if (savedOcrspaceLang) setOcrspaceLang(savedOcrspaceLang);
  }, []);

  const saveAllSettings = () => {
    localStorage.setItem("ocrEngine", ocrEngine);
    localStorage.setItem("ocrspaceApiKey", ocrspaceKey);
    localStorage.setItem("paddleOcrUrl", paddleOcrUrl);
    localStorage.setItem("paddleOcrLang", paddleOcrLang);
    localStorage.setItem("easyOcrUrl", easyOcrUrl);
    localStorage.setItem("easyOcrLang", easyOcrLang);
    localStorage.setItem("ocrspaceLang", ocrspaceLang);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="relative min-h-screen w-full bg-backga text-[#e2e2e7] font-sans overflow-x-hidden touch-pan-y">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 pb-40">

        {/* ÜST PANEL */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between sticky top-0 z-50 py-4 bg-backga/95 backdrop-blur-md border-b border-white/5 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-full bg-[#1c1c27] hover:bg-[#252533] text-[#00ffd5] border border-white/5 transition-all shrink-0">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter text-text">SİSTEM AYARLARI</h1>
          </div>
          <button
            onClick={saveAllSettings}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 md:py-3 rounded-xl bg-text text-black font-black text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,213,0.2)]"
          >
            <Save size={18} />
            {isSaved ? "DEĞİŞİKLİKLER KAYDEDİLDİ" : "AYARLARI KAYDET"}
          </button>
        </div>

        {/* 1. METİN API ANAHTARLARI */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Key size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-[#FF7B00]">Metin API Anahtarları (Text & Çeviri)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <KeyInput label="GEMINI API KEY" value="" onChange={() => { }} />
            <KeyInput label="GROQ API KEY" value="" onChange={() => { }} />
            <KeyInput label="DEEPL API KEY" value="" onChange={() => { }} />
          </div>
        </section>

        {/* 2. RESİM API ANAHTARI */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Image size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-[#FF7B00]">OCR & Inpainting Api Keys</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <KeyInput
              label="OCR.SPACE API KEY"
              value={ocrspaceKey}
              onChange={(val) => setOcrspaceKey(val)}
            />
            <KeyInput
              label="PADDLE-OCR API Key"
              value={paddleOcrUrl}
              onChange={(val) => setPaddleOcrUrl(val)}
            />
            <KeyInput
              label="EASY-OCR URL"
              value={easyOcrUrl}
              onChange={(val) => setEasyOcrUrl(val)}
            />
          </div>
        </section>

        {/* 3. ÇEVİRİ AYARLARI */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Languages size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest">Çeviri Ayarları</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <CustomSelect
              label="Varsayılan Çeviri Servisi"
              value=""
              options={[
                { code: "gemini", name: "Gemini" },
                { code: "groq", name: "Groq" },
                { code: "deepl", name: "DeepL" },
              ]}
              onChange={() => { }}
            />
            <CustomSelect
              label="Hedef Dil"
              value=""
              options={[
                { code: "tr", name: "Türkçe" },
                { code: "en", name: "English" },
              ]}
              onChange={() => { }}
            />
          </div>
        </section>

        {/* 4. DEEPL DİL MOTORU */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-6 relative z-40">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Languages size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest">DeepL Dil Tercihleri</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <CustomSelect
              label="Kaynak Dil (Source)"
              value=""
              options={[
                { code: "auto", name: "Otomatik Algıla (Auto-Detect)" },
                { code: "ja", name: "Japonca" },
                { code: "zh", name: "Çince" },
                { code: "ko", name: "Korece" },
                { code: "en", name: "İngilizce" },
              ]}
              onChange={() => { }}
            />
            <CustomSelect
              label="Hedef Dil (Target)"
              value=""
              options={[
                { code: "tr", name: "Türkçe" },
                { code: "en", name: "İngilizce" },
              ]}
              onChange={() => { }}
            />
          </div>
        </section>

        {/* OCR (YAZI TANIMA) AYARLARI */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <ScanSearch size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-[#00ffd5]">OCR Ayarları</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <CustomSelect
              label="Varsayılan OCR Motoru"
              value={ocrEngine}
              options={OcrEngines}
              onChange={(val) => setOcrEngine(val)}
            />
            {getLanguagesForEngine(ocrEngine).length > 0 && (
                <CustomSelect
                  label="OCR Kaynak Dil"
                  value={
                    ocrEngine === "paddleocr" ? paddleOcrLang : 
                    ocrEngine === "easyocr" ? easyOcrLang : ocrspaceLang
                  }
                  options={getLanguagesForEngine(ocrEngine)}
                  onChange={(val) => {
                    if (ocrEngine === "paddleocr") setPaddleOcrLang(val);
                    else if (ocrEngine === "easyocr") setEasyOcrLang(val);
                    else setOcrspaceLang(val);
                  }}
                />
            )}
          </div>
        </section>

        {/* 4. AI KONTROL MERKEZİ */}
        <section className="p-5 sm:p-6 rounded-2xl border border-white/5 bg-[#1c1c27] shadow-2xl space-y-8 relative z-30">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Terminal size={20} className="text-text" />
            <h2 className="font-black uppercase text-[10px] sm:text-xs tracking-widest">AI Kontrol Merkezi</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
            <div className="space-y-6">

              {/* CHUNK SIZE AYARLARI */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-text">
                  <Layers size={16} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Motor Kapasite Ayarları (Chunk)</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-blue-400 uppercase ml-1">Gemini</label>
                    <input
                      type="number"
                      placeholder="400"
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-orange-400 uppercase ml-1">Groq</label>
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-tetx uppercase ml-1">DeepL</label>
                    <input
                      type="number"
                      placeholder="150"
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono outline-none focus:border-text/50"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-white/40 italic">* Tek seferde gönderilecek satır sayısı.</p>
              </div>

              <div className="flex items-center gap-3 text-text mt-6">
                <Settings2 size={18} />
                <h2 className="font-black uppercase text-[10px] tracking-widest">Özel Promptlar</h2>
              </div>
            </div>

            <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 sm:p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <ShieldCheck size={25} />
                <span className="text-[17px] font-black uppercase">Önemli Uyarı</span>
              </div>
              <p className="text-[10px] sm:text-[13px] text-white/75 leading-relaxed opacity-60">
                Özel promptlar ile çeviri davranışını kişiselleştirebilirsiniz.
              </p>
            </div>
          </div>

          {/* PROMPT KUTULARI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-4 border-t border-white/5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-400 pt-3">
                <Cpu size={14} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Gemini Özel Prompt</span>
              </div>
              <textarea
                placeholder="Gemini için özel talimatlar..."
                className="w-full h-44 p-4 rounded-xl bg-black/60 border border-white/5 text-xs font-mono outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-orange-400 pt-3">
                <Cpu size={14} />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Groq Özel Prompt</span>
              </div>
              <textarea
                placeholder="Groq/Llama için özel talimatlar..."
                className="w-full h-44 p-4 rounded-xl bg-black/60 border border-white/5 text-xs font-mono outline-none focus:border-orange-500/50 transition-all resize-none shadow-inner"
              />
            </div>
          </div>
        </section>

        {/* GÜVENLİK NOTU */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 sm:p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <ShieldCheck size={25} />
            <span className="text-[17px] font-black uppercase">Güvenlik Notu</span>
          </div>
          <p className="text-[10px] sm:text-[13px] text-white leading-relaxed opacity-60">
            <b>API Anahtarınızı sunucumuza ya da başka yerlere paylaşmayız. API Anahtarınız sadece tarayıcı belleğinize kaydedilir.</b>
          </p>
        </div>

      </div>
    </div>
  );
}

function CustomSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { code: string; name: string }[];
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.code === value);

  return (
    <div className="space-y-2 sm:space-y-3 relative" ref={containerRef}>
      <label className="text-[9px] sm:text-[10px] font-black opacity-40 uppercase tracking-widest ml-1">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 rounded-xl border bg-black/40 border-white/10 hover:border-text flex items-center justify-between cursor-pointer transition-all"
      >
        <span className="text-[11px] sm:text-sm font-bold text-gray-300">
          {selectedOption?.name || "Seçiniz..."}
        </span>
        <ChevronDown size={16} className={`text-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#1c1c27] border border-text/20 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <div
                key={opt.code}
                onClick={() => { onChange(opt.code); setIsOpen(false); }}
                className="p-4 text-[11px] sm:text-xs font-bold hover:bg-text hover:text-black transition-colors cursor-pointer border-b border-white/5 last:border-0"
              >
                {opt.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between px-1">
        <label className="text-[8px] sm:text-[9px] font-black text-text tracking-widest uppercase opacity-70 group-hover:opacity-100 transition-opacity">{label}</label>
        <button onClick={() => setShow(!show)} className="text-[8px] sm:text-[9px] font-bold opacity-30 hover:opacity-100 transition-opacity uppercase">
          {show ? "Gizle" : "Göster"}
        </button>
      </div>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="API anahtarını yapıştırın..."
        className="w-full p-4 md:p-3 rounded-xl bg-black/40 border border-white/5 outline-none focus:border-text/40 focus:bg-black/60 transition-all font-mono text-[10px] sm:text-xs placeholder:text-white/5"
      />
    </div>
  );
}
