// app/ocr/paddleocr.ts

interface BBoxLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Bounding Box (Kutu) Kümeleme Algoritması: Aynı balon içindeki satırları birleştirir
function groupLinesIntoParagraphs(lines: BBoxLine[]): BBoxLine[] {
  if (lines.length === 0) return [];

  // Y Ekseni (Yukarıdan aşağı) sıralama
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  const paragraphs: BBoxLine[] = [];

  for (const line of sorted) {
    let added = false;

    for (const p of paragraphs) {
      const verticalGap = line.y0 - p.y1;
      const horizontalOverlap = Math.max(0, Math.min(line.x1, p.x1) - Math.max(line.x0, p.x0));

      const pHeight = p.y1 - p.y0;
      const lineHeight = line.y1 - line.y0;
      const avgHeight = (pHeight + lineHeight) / 2;

      const pCenter = (p.x0 + p.x1) / 2;
      const lCenter = (line.x0 + line.x1) / 2;
      const centerDist = Math.abs(pCenter - lCenter);

      const isVerticalClose = verticalGap > -avgHeight && verticalGap < avgHeight * 1.8;
      const isHorizontalAligned = centerDist < (p.x1 - p.x0) || centerDist < (line.x1 - line.x0) || horizontalOverlap > 0 || centerDist < avgHeight * 2;

      if (isVerticalClose && isHorizontalAligned) {
        // Balonları Birleştir!
        p.text += " " + line.text;
        p.x0 = Math.min(p.x0, line.x0);
        p.y0 = Math.min(p.y0, line.y0);
        p.x1 = Math.max(p.x1, line.x1);
        p.y1 = Math.max(p.y1, line.y1);
        added = true;
        break;
      }
    }

    if (!added) {
      paragraphs.push({ ...line });
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

        const text = Array.isArray(textInfo) ? textInfo[0] : textInfo;
        if (!text || text.trim().length < 1) continue;

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
      });
    }

    console.log(`[PaddleOCR] Başarı! Orijinal sistemden ${rawLines.length} satır ayrıştırılıp ${results.length} kocaman Manga balonu olarak oluşturuldu.`);
    return results;
  } catch (error) {
    console.error("[PaddleOCR] İletişim Hatası:", error);
    return [];
  }
}
