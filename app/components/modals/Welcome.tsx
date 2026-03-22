"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Info, CheckCircle2, Key } from 'lucide-react';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    // Daha önce giriş yapılmış mı kontrol et
    const isConfirmed = localStorage.getItem("doxmaxima_confirmed");
    if (!isConfirmed) setIsOpen(true);
  }, []);

  const handleConfirm = () => {
    if (checked && apiKey.trim() !== "") {
      localStorage.setItem("doxmaxima_confirmed", "true");
      localStorage.setItem("gemini_key", apiKey); // İlk anahtarı kaydet
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-backg border border-[#2bebc1]/20 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-[#2bebc1]/10 rounded-lg text-[#2bebc1]">
            <Info size={24} />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[#2bebc1]">SİSTEM BİLGİSİ</h2>
        </div>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed mb-8">
          <p>● <span className="text-[#2bebc1] font-bold">Doxmaxima manga çeviri</span> sitesine hoş geldiniz. bu site Ai ile manga çevirme üzerine kuruludur.</p>
          <p>● <Link href='/guide' className='text-blue-400 hover:underline'>Api Key</Link> Hakkında bilgi almak için api key nasıl alınır sayfasını inceleyiniz.</p>
          <p>● <Link href='/settings' className='text-blue-400 hover:underline'>Tüm ayarlar</Link> sayfasını kesinlikle ayarlarınızı kontrol ediniz.</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Key size={16} className="absolute left-3 top-3.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="api key giriniz"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-[#2bebc1] transition-all text-[#2bebc1]"
            />
          </div>

          <label className="flex items-center gap-3 p-4 bg-black/40 rounded-xl cursor-pointer hover:bg-black/60 transition-colors group">
            <input 
              type="checkbox" 
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="w-5 h-5 rounded border-[#2bebc1]/30 bg-transparent text-[#2bebc1] focus:ring-[#2bebc1] cursor-pointer"
            />
            <span className="text-[11px] font-bold text-gray-400 group-hover:text-white uppercase tracking-widest leading-tight">
              Okudum, anladım ve onaylıyorum.
            </span>
          </label>

          <button 
            disabled={!checked || apiKey.trim() === ""}
            onClick={handleConfirm}
            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-20 disabled:grayscale"
            style={{ backgroundColor: '#2bebc1', color: '#000' }}
          >
            <CheckCircle2 size={18} />
            ONAYLIYORUM
          </button>
        </div>
      </div>
    </div>
  );
}