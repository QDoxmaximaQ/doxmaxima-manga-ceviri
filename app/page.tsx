// app/page.tsx
"use client";

import { useState, useEffect } from 'react';
import WelcomeModal from './components/modals/Welcome';
import Header from './components/layout/TopBar';
import Rightpanel from './components/layout/RightPanel';
import Canvas from './components/editor/canvas';
import Leftpanel from './components/layout/LeftPanel';
import Bottompanel from './components/layout/BottomPanel';

/**
 * TİPLERİ VE HOOK'U MERKEZİ DOSYADAN ÇEKİYORUZ
 * Bu sayede 'textConfig', 'selection' ve 'dataURL' gibi tüm özellikler 
 * proje genelinde (Canvas, Katmanlar, Araçlar) hatasız bir şekilde tanınır.
 */
import { useLayers, Layer, MangaPage, ToolSettings } from './components/hooks/useLayers';

export default function Home() {
  /**
   * DURUM YÖNETİMİ
   * Sol panelden seçilen aracın bilgisini ve AI işlem durumunu tutar.
   */
  const [activeTool, setActiveTool] = useState("handle");
  const [isProcessing, setIsProcessing] = useState(false); // AI işlem durumu (Loading Overlay için)
  const [systemMessage, setSystemMessage] = useState({ text: "Sistem: Hazır", color: "text-text/90" });

  /**
   * --- MERKEZİ VERİ YÖNETİMİ (HOOK) ---
   * Tüm sayfa ve katman lojiği useLayers hook'u içerisinde yönetiliyor.
   */
  const {
    pages,
    setPages,
    activePageId,
    activeLayerId,
    setActiveLayerId,
    activePage,
    addPages,
    deletePage,
    selectPage,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo
  } = useLayers();

  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    brushSize: 5,
    brushColor: "#ffffff",
    brushOpacity: 1.0,
    brushHardness: 100,
    eraserSize: 20,
    eraserOpacity: 1.0,
    eraserHardness: 100,
    textSize: 20,
    textColor: "#000000",
    textFont: "Arial"
  });

  /**
   * --- KISAYOL TUŞLARI ---
   * Kullanıcının araçlar arasında hızlıca geçiş yapmasını sağlar.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      // Yazı alanlarındayken kısayolları devre dışı bırak
      if (
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement
      ) {
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b': setActiveTool("fırca"); break;
        case 'e': setActiveTool("remove"); break;
        case 't': setActiveTool("metin"); break;
        case 'w': setActiveTool("secme"); break;
        case 'r': setActiveTool("otosecme"); break;
        case ' ':
          e.preventDefault();
          setActiveTool("handle");
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * --- BOŞ CANVAS KORUMASI ---
   * Eğer yüklenmiş hiçbir resim/sayfa yoksa, diğer araçların kullanılmasını engeller 
   * ve aracı zorunlu olarak 'handle' (kaydırma) yapar.
   */
  const isCanvasEmpty = pages.length === 0;

  useEffect(() => {
    if (isCanvasEmpty && activeTool !== "handle") {
      setActiveTool("handle");
    }
  }, [isCanvasEmpty, activeTool]);

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-backg text-white select-none">
      {/* Editör Açılış Bilgilendirme Ekranı */}
      <WelcomeModal />

      {/* Üst Navigasyon Menüsü */}
      <Header
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sol Panel: Araç seçimi */}
        <Leftpanel 
          activeTool={activeTool} 
          setActiveTool={setActiveTool} 
          isCanvasEmpty={isCanvasEmpty} 
          setSystemMessage={setSystemMessage} 
        />

        {/* Orta Alan: Ana Çizim ve İşlem Tuvali
            setIsProcessing: Hook sistemi ile çalışan AI aracının loading durumunu Canvas içinden yönetmek için aktarıldı.
        */}
        <Canvas
          activeTool={activeTool}
          uploadedImage={activePage?.url || null}
          pages={pages}
          setPages={setPages}
          activePageId={activePageId}
          activeLayerId={activeLayerId}
          setActiveLayerId={setActiveLayerId}
          toolSettings={toolSettings}
          setIsProcessing={setIsProcessing}
          pushHistory={pushHistory} // ← ekle
        />

        {/* Sağ Panel: Katman Yönetimi, Sayfa Listesi ve Tool Ayarları */}
        <Rightpanel
          pages={pages}
          setPages={setPages}
          activePageId={activePageId}
          setActivePageId={selectPage}
          onDeletePage={deletePage}
          activeLayerId={activeLayerId}
          setActiveLayerId={setActiveLayerId}
          activeTool={activeTool}
          toolSettings={toolSettings}
          setToolSettings={setToolSettings}
        />
      </div>

      {/* AI İŞLEM OVERLAY: İşlem sürerken kullanıcıyı bilgilendirir ve tıklamaları engeller */}
      {isProcessing && (
        <div className="absolute inset-0 z-999 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-text border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(0,255,213,0.3)]"></div>
            <div className="flex flex-col items-center">
              <p className="text-text font-black uppercase tracking-[0.3em] animate-pulse">AI İşleniyor</p>
              <p className="text-[10px] text-texts/40 uppercase mt-2">Arka plan temizleniyor ve metinler çıkarılıyor...</p>
            </div>
          </div>
        </div>
      )}

      {/* Alt Panel: Çoklu resim yükleme ve hızlı sayfa navigasyonu */}
      <Bottompanel 
        onImagesUpload={(urls) => {
          addPages(urls);
          setSystemMessage({ text: "Sistem: Hazır", color: "text-text/90" });
        }} 
        systemMessage={systemMessage}
      />
    </main>
  );
}