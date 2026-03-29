// app/ocr/paddleocr.ts

interface BBoxLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Bounding Box (Kutu) Kümeleme Algoritması — v2 (Snowball-Proof)
// Eski sürüm paragraf büyüdükçe avgHeight de büyüyordu → zincirleme büyüme ile tüm sayfa tek kutu oluyordu.
// Yeni sürüm: her zaman satırın kendi yüksekliğini referans alır, sınırlar sıkılaştırıldı.
function groupLinesIntoParagraphs(lines: BBoxLine[]): (BBoxLine & { rawLines: BBoxLine[] })[] {
  if (lines.length === 0) return [];

  // Satır yüksekliklerinin medyanını hesapla — bu tüm eşikler için sabit referans olarak kullanılır
  const lineHeights = lines.map(l => l.y1 - l.y0).sort((a, b) => a - b);
  const medianLineHeight = lineHeights[Math.floor(lineHeights.length / 2)] || 20;

  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  const paragraphs: (BBoxLine & { rawLines: BBoxLine[], _baseLineH: number })[] = [];

  for (const line of sorted) {
    let added = false;
    const lineHeight = line.y1 - line.y0;
    const lineWidth = line.x1 - line.x0;

    for (const p of paragraphs) {
      // SABİT REFERANS: Paragrafın büyümesiyle değil, satır yüksekliğiyle eşik belirle
      const refHeight = Math.max(medianLineHeight, lineHeight);

      const verticalGap = line.y0 - p.y1;

      // Dikey yakınlık: satır yüksekliğinin 1.2 katından fazla boşluk olmamalı
      // Negatif değer (iç içe geçme) satır yüksekliğinin yarısını geçmemeli
      const isVerticalClose = verticalGap > -(refHeight * 0.5) && verticalGap < refHeight * 1.2;

      // Yatay hizalama: gerçek örtüşme olmalı VEYA merkezler birbirine çok yakın olmalı
      const overlapStart = Math.max(line.x0, p.x0);
      const overlapEnd = Math.min(line.x1, p.x1);
      const horizontalOverlap = Math.max(0, overlapEnd - overlapStart);

      const pWidth = p.x1 - p.x0;
      const minWidth = Math.min(pWidth, lineWidth);

      // En az %30 genişlik örtüşmesi gerekli (çok uzak balonları birleştirmeyi engeller)
      const isHorizontalAligned = horizontalOverlap > minWidth * 0.3;

      // BOYUT SINIRI: Birleştirilmiş kutunun alanı çok büyümüşse, artık ekleme
      const mergedW = Math.max(p.x1, line.x1) - Math.min(p.x0, line.x0);
      const mergedH = Math.max(p.y1, line.y1) - Math.min(p.y0, line.y0);
      const maxArea = (medianLineHeight * 12) * (medianLineHeight * 20); // yaklaşık konuşma balonu boyutu sınırı
      const isSizeReasonable = (mergedW * mergedH) < maxArea;

      // ORAN SINIRI: Balon çok uzun/geniş olmamalı (en/boy oranı)
      const aspectRatio = mergedW / mergedH;
      const isAspectOk = aspectRatio > 0.15 && aspectRatio < 6;

      if (isVerticalClose && isHorizontalAligned && isSizeReasonable && isAspectOk) {
        p.text += " " + line.text;
        p.x0 = Math.min(p.x0, line.x0);
        p.y0 = Math.min(p.y0, line.y0);
        p.x1 = Math.max(p.x1, line.x1);
        p.y1 = Math.max(p.y1, line.y1);
        p.rawLines.push(line);
        added = true;
        break;
      }
    }

    if (!added) {
      paragraphs.push({ ...line, rawLines: [line], _baseLineH: lineHeight });
    }
  }

  return paragraphs;
}

export async function recognizeWithPaddleOCR(imageSource: string, endpointUrl: string) {
  console.log("[PaddleOCR] Özel Vercel x HuggingFace Gradio isteği başlıyor...");

  if (!endpointUrl) throw new Error("PaddleOCR Endpoint URL tanımlanmamış. Ayarlardan kontrol edin.");

  // Gradio/client sadece ana sayfaya bağlanmak ister (örn: https://qdoxmaximaq-manga.hf.space).
  let formattedUrl = endpointUrl.replace(/\/api\/predict$/, '').replace(/\/run\/predict$/, '').replace(/\/call\/predict$/, '').replace(/\/$/, '');

  console.log(`[PaddleOCR] Kullanılacak Hedef Root URL: ${formattedUrl}`);

  // --- HUGGING FACE SPACE DURUM KONTROLÜ (RUNNING MI?) ---
  console.log(`[PaddleOCR] Space çalışma durumu kontrol ediliyor...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 sn içinde yanıt vermezse kapalı/building say

    // Gradio sunucusu eğer 'Running' ise /config yolundan saf JSON döner.
    // Nếu Building, Paused veya Sleeping ise 503 veya HTML sayfası (HuggingFace loading screen) döner.
    const configRes = await fetch(`${formattedUrl}/config`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!configRes.ok) {
      throw new Error(`Space hazır değil (HTTP ${configRes.status})`);
    }

    const configText = await configRes.text();
    JSON.parse(configText); // JSON parse edilemiyorsa HTML dönmüştür (Building/Sleeping ekranı)
  } catch (checkError) {
    console.warn("[PaddleOCR] HuggingFace Repo Kontrol Başarısız:", checkError);
    throw new Error("HF_NOT_RUNNING");
  }

  // Resim URL formatındaysa (blob vs) canvas üzerinden base64'e çeviriyoruz
  const getBase64 = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });

  let base64Image = imageSource;
  if (!imageSource.startsWith('data:image')) {
    try {
      base64Image = await getBase64(imageSource);
      console.log("[PaddleOCR] Resim başarıyla Base64 formatına çevrildi.");
    } catch (e) {
      console.error("[PaddleOCR] Base64 çeviri hatası:", e);
      throw new Error("Resim formatı çözülemedi.");
    }
  }

  // Gradio API Standart Gönderimi
  try {
    const { Client, handle_file } = await import("@gradio/client");

    console.log(`[PaddleOCR] Gradio Client ile sunucuya bağlanılıyor: ${formattedUrl}...`);
    const app = await Client.connect(formattedUrl);

    console.log("[PaddleOCR] Bağlantı başarılı. Tahmin (predict) isteği yollanıyor...");

    // Resim → File dönüşümü (Gradio uyumluluğu)
    console.log("[PaddleOCR] Resim nesnesi Dosyaya (File) çevriliyor (Gradio uyumluluğu için)...");
    const base64Response = await fetch(base64Image);
    const imageBlob = await base64Response.blob();
    const imageFile = new File([imageBlob], "manga_page.png", { type: "image/png" });

    const userLang = (typeof window !== 'undefined' && localStorage.getItem("paddleOcrLang")) || "en";

    // Ayarlardaki dil değerini app.py'nin kabul ettiği değerlere (choices) eşleştir
    const langMap: Record<string, string> = {
      "en": "en",
      "japan": "japan",
      "ch": "ch",
      "korean": "korean",
      "arabic": "arabic",
      "fr": "french",
      "german": "german",
      "ru": "cyrillic",
      "latin": "latin"
    };
    const mappedLang = langMap[userLang] || "en";

    console.log(`[PaddleOCR] /predict endpointine istek yollanıyor, parametreler: (Resim, ${mappedLang})...`);

    // app.py'ye göre /predict endpoint'i 2 parametre bekler: Input(Image) & Language(Dropdown)
    const result = await app.predict("/predict", [handle_file(imageFile), mappedLang]);

    const data = result as any;
    console.log("[PaddleOCR] API Yanıtı alındı. Çıktı:", JSON.stringify(data).substring(0, 500));

    const rawLines: BBoxLine[] = [];

    // Sunucudan gelen veriyi ayrıştır: data.data[0] → OCR sonuçları
    // Format: data.data[0] = [[bbox_4points, [text, score]], ...]
    let predictions: any[] = [];

    if (data.data && Array.isArray(data.data[0])) {
      const candidate = data.data[0];
      // İlk elemanın yapısını kontrol et: [[[x,y],[x,y],[x,y],[x,y]], ["text", score]]
      // Eğer candidate[0][0] bir 4-noktalı bbox ise → doğru seviyedeyiz
      // Eğer candidate[0][0][0] bir 4-noktalı bbox ise → bir kademe daha iç
      if (candidate.length > 0 && Array.isArray(candidate[0])) {
        const firstItem = candidate[0];
        if (Array.isArray(firstItem[0]) && Array.isArray(firstItem[0][0]) && typeof firstItem[0][0][0] === 'number') {
          // firstItem[0] = [[x,y],[x,y],...] → candidate doğru seviye
          predictions = candidate;
        } else if (Array.isArray(firstItem[0]) && Array.isArray(firstItem[0][0]) && Array.isArray(firstItem[0][0][0])) {
          // Ekstra iç içe geçmiş: candidate[0] asıl sonuçlar
          predictions = firstItem;
        } else {
          predictions = candidate;
        }
      }
    } else {
      predictions = data.data || [];
    }

    console.log(`[PaddleOCR] Çözümlenen Kutucuk (Satır) Sayısı: ${predictions.length}`);

    if (predictions && Array.isArray(predictions)) {
      for (const item of predictions) {
        if (!item || item.length < 2) continue;

        const box = item[0]; // [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
        const textInfo = item[1]; // ["Metin", 0.98]

        if (!box || !Array.isArray(box) || box.length < 4) continue;

        const rawText = Array.isArray(textInfo) ? textInfo[0] : textInfo;
        const text = rawText != null ? String(rawText).trim() : "";
        // Nokta (.), ünlem (!) gibi tek karakterli işaretler manga için önemli
        if (!text || text.length < 1) continue;

        const xs = box.map((point: number[]) => point[0]);
        const ys = box.map((point: number[]) => point[1]);

        rawLines.push({
          text: text.trim(),
          x0: Math.min(...xs),
          y0: Math.min(...ys),
          x1: Math.max(...xs),
          y1: Math.max(...ys),
        });
      }
    }

    // Orijinal OCR verilerini Anime / Manga tarzı paragraf balonlarına özel algoritmamızla birleştir:
    const paragraphs = groupLinesIntoParagraphs(rawLines);
    const results: any[] = [];

    for (const p of paragraphs) {
      results.push({
        text: p.text,
        confidence: 100,
        bbox: { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 },
        width: p.x1 - p.x0,
        height: p.y1 - p.y0,
        centerX: (p.x0 + p.x1) / 2,
        centerY: (p.y0 + p.y1) / 2,
        rawLines: p.rawLines,
      });
    }

    console.log(`[PaddleOCR] Başarı! Orijinal sistemden ${rawLines.length} satır ayrıştırılıp ${results.length} kocaman Manga balonu olarak oluşturuldu.`);
    return results;
  } catch (error: any) {
    console.error("[PaddleOCR] İletişim Hatası:", error);
    throw new Error("HuggingFace Error: " + (error.message || "Bilinmeyen Hata"));
  }
}
