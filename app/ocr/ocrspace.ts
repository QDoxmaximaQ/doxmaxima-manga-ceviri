// app/ocr/ocrspace.ts

interface BBoxLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Birbirine yakın olan manga satırlarını (Lines) aynı konuşma balonu (Paragraph) olarak birleştirir — v2 (Snowball-Proof)
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
      const isVerticalClose = verticalGap > -(refHeight * 0.5) && verticalGap < refHeight * 1.2;

      // Yatay hizalama: gerçek örtüşme olmalı
      const overlapStart = Math.max(line.x0, p.x0);
      const overlapEnd = Math.min(line.x1, p.x1);
      const horizontalOverlap = Math.max(0, overlapEnd - overlapStart);

      const pWidth = p.x1 - p.x0;
      const minWidth = Math.min(pWidth, lineWidth);

      // En az %30 genişlik örtüşmesi gerekli
      const isHorizontalAligned = horizontalOverlap > minWidth * 0.3;

      // BOYUT SINIRI: Birleştirilmiş kutunun alanı çok büyümüşse, artık ekleme
      const mergedW = Math.max(p.x1, line.x1) - Math.min(p.x0, line.x0);
      const mergedH = Math.max(p.y1, line.y1) - Math.min(p.y0, line.y0);
      const maxArea = (medianLineHeight * 12) * (medianLineHeight * 20);
      const isSizeReasonable = (mergedW * mergedH) < maxArea;

      // ORAN SINIRI: Balon çok uzun/geniş olmamalı
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

export async function recognizeWithOCRSpace(imageSource: string, apiKey: string) {
  console.log("[OCR.Space] API işlemi başlıyor...");

  // OCR.space ücretsiz API limiti ~1MB. Resmi JPEG'e çevir ve gerekirse küçült.
  const MAX_BASE64_SIZE = 1024 * 1024; // 1MB (base64 string boyutu olarak)

  // Ölçek bilgisini tutmak için — resim küçültülürse koordinatları geri ölçeklemek lazım
  let scaleX = 1;
  let scaleY = 1;

  const getBase64Compressed = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;
        let w = origW;
        let h = origH;
        let quality = 0.85;

        const tryCompress = (): string => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          return c.toDataURL('image/jpeg', quality);
        };

        let result = tryCompress();
        console.log(`[OCR.Space] İlk sıkıştırma: ${w}x${h}, kalite=${quality}, boyut=${(result.length / 1024).toFixed(0)}KB`);

        // Boyut hâlâ çok büyükse, resmi kademeli olarak küçült
        let attempts = 0;
        while (result.length > MAX_BASE64_SIZE && attempts < 5) {
          if (quality > 0.5) {
            quality -= 0.15;
          } else {
            // Kaliteyi daha fazla düşürmek yerine boyutu küçült
            w = Math.round(w * 0.75);
            h = Math.round(h * 0.75);
          }
          result = tryCompress();
          attempts++;
          console.log(`[OCR.Space] Yeniden sıkıştırma #${attempts}: ${w}x${h}, kalite=${quality.toFixed(2)}, boyut=${(result.length / 1024).toFixed(0)}KB`);
        }

        // Ölçek faktörünü kaydet (küçültülmüşse koordinatları geri ölçeklemek için)
        scaleX = origW / w;
        scaleY = origH / h;
        if (scaleX !== 1 || scaleY !== 1) {
          console.log(`[OCR.Space] Resim ölçeklendi: ${origW}x${origH} → ${w}x${h} (scaleX=${scaleX.toFixed(2)}, scaleY=${scaleY.toFixed(2)})`);
        }

        console.log(`[OCR.Space] Son boyut: ${(result.length / 1024).toFixed(0)}KB (limit: ${(MAX_BASE64_SIZE / 1024).toFixed(0)}KB)`);
        resolve(result);
      };
      img.onerror = reject;
      img.src = url;
    });

  let base64Image = imageSource;
  if (!imageSource.startsWith('data:image')) {
    try {
      base64Image = await getBase64Compressed(imageSource);
      console.log("[OCR.Space] Base64 çevirisi başarılı.");
    } catch (e) {
      console.error("[OCR.Space] Base64 çeviri hatası:", e);
      throw new Error("Resim formatı API'ye uygun değil.");
    }
  } else {
    // Zaten base64 ise de boyut kontrolü yap
    console.log(`[OCR.Space] Gelen base64 boyutu: ${(base64Image.length / 1024).toFixed(0)}KB`);
    if (base64Image.length > MAX_BASE64_SIZE) {
      console.log("[OCR.Space] Base64 çok büyük, yeniden sıkıştırılıyor...");
      base64Image = await getBase64Compressed(base64Image);
    }
  }

  // OCR.Space API fonksiyonu — belirtilen engine ile çalıştırır
  const runOCR = async (engineId: string): Promise<BBoxLine[]> => {
    const formData = new FormData();
    formData.append("base64Image", base64Image);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "true");
    formData.append("OCREngine", engineId);
    formData.append("scale", "true");              // Resmi ölçeklendirerek daha iyi algılama
    formData.append("detectOrientation", "true");  // Eğik yazıları da algıla

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": apiKey,
      },
      body: formData,
    });

    const data = await response.json();
    console.log(`[OCR.Space] Engine ${engineId} API Yanıtı alındı:`, data);

    if (data.IsErroredOnProcessing) {
      console.error(`[OCR.Space] Engine ${engineId} İşlem Hatası:`, data.ErrorMessage);
      throw new Error("OCR.Space Hatası: " + data.ErrorMessage);
    }

    const lines: BBoxLine[] = [];
    const parsedResults = data.ParsedResults?.[0];

    if (parsedResults && parsedResults.TextOverlay && parsedResults.TextOverlay.Lines) {
      for (const line of parsedResults.TextOverlay.Lines) {
        const text = line.LineText?.trim();

        // Nokta (.), ünlem (!) gibi tek karakterli işaretler manga için önemli — sadece tamamen boş olanları filtrele
        if (!text || text.length < 1) continue;

        if (line.Words && line.Words.length > 0) {
          const lefts = line.Words.map((w: any) => w.Left as number);
          const tops = line.Words.map((w: any) => w.Top as number);
          const rights = line.Words.map((w: any) => (w.Left + w.Width) as number);
          const bottoms = line.Words.map((w: any) => (w.Top + w.Height) as number);

          lines.push({
            text,
            x0: Math.min(...lefts) * scaleX,
            y0: Math.min(...tops) * scaleY,
            x1: Math.max(...rights) * scaleX,
            y1: Math.max(...bottoms) * scaleY,
          });
        }
      }
    }

    return lines;
  };

  try {
    // --- AŞAMA 1: Engine 2 ile dene (yoğun metin için optimize) ---
    console.log("[OCR.Space] Engine 2 deneniyor...");
    let rawLines = await runOCR("2");
    console.log(`[OCR.Space] Engine 2 sonucu: ${rawLines.length} satır bulundu.`);

    // --- AŞAMA 2: Engine 2 boş dönerse, Engine 1 ile tekrar dene ---
    // Engine 1 büyük/kalın yazılar ve karmaşık arka planlar için daha iyi çalışıyor
    if (rawLines.length === 0) {
      console.log("[OCR.Space] Engine 2 sonuç bulamadı, Engine 1 ile yeniden deneniyor...");
      rawLines = await runOCR("1");
      console.log(`[OCR.Space] Engine 1 sonucu: ${rawLines.length} satır bulundu.`);
    }

    // Ayrı ayrı bulunan tüm satırları tekrar baloncuk paragrafı halinde dönüştürüyoruz,
    // ancak saf satırları (rawLines) içinde barındırıyoruz ki arayüzde tam oturan çizgiler çizebilelim.
    const paragraphs = groupLinesIntoParagraphs(rawLines);
    const results = [];

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

    console.log(`[OCR.Space] ${rawLines.length} satır işlendi, ${results.length} baloncuk olarak birleştirildi.`);
    return results;
  } catch (error: any) {
    console.error("[OCR.Space] İletişim Hatası:", error);
    throw new Error("OCR.Space Error: " + (error.message || "Bilinmeyen Hata"));
  }
}
