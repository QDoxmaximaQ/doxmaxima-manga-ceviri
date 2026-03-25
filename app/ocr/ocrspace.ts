// app/ocr/ocrspace.ts

interface BBoxLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Birbirine yakın olan manga satırlarını (Lines) aynı konuşma balonu (Paragraph) olarak birleştirir
function groupLinesIntoParagraphs(lines: BBoxLine[]): BBoxLine[] {
  if (lines.length === 0) return [];
  
  // Satırları yukarıdan aşağıya (Y eksenine) göre sırala
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  const paragraphs: BBoxLine[] = [];

  for (const line of sorted) {
    let added = false;
    
    // Satırın mevcut bir konuşma balonuna ait olup olmadığını kontrol et
    for (const p of paragraphs) {
      const verticalGap = line.y0 - p.y1;
      const horizontalOverlap = Math.max(0, Math.min(line.x1, p.x1) - Math.max(line.x0, p.x0));
      
      const pHeight = p.y1 - p.y0;
      const lineHeight = line.y1 - line.y0;
      const avgHeight = (pHeight + lineHeight) / 2;

      // Merkezlerin X eksenindeki uzaklığı
      const pCenter = (p.x0 + p.x1) / 2;
      const lCenter = (line.x0 + line.x1) / 2;
      const centerDist = Math.abs(pCenter - lCenter);
      
      // Aynı konuşma balonunda (Paragraph) olma şartları:
      // 1. Dikey olarak çok yakın olmalı (satır atlaması kadar mesafe: avgHeight * 1.8)
      //    bazen kutular iç içe girer (-avgHeight)
      const isVerticalClose = verticalGap > -avgHeight && verticalGap < avgHeight * 1.8;
      
      // 2. Yatay eksende hizalı olmalılar (Merkezleri yakın veya üst üste biniyor olmalı)
      const isHorizontalAligned = centerDist < (p.x1 - p.x0) || centerDist < (line.x1 - line.x0) || horizontalOverlap > 0 || centerDist < avgHeight * 2;

      if (isVerticalClose && isHorizontalAligned) {
        // Balonları Birleştir!
        p.text += " " + line.text;
        p.x0 = Math.min(p.x0, line.x0);
        p.y0 = Math.min(p.y0, line.y0);
        p.x1 = Math.max(p.x1, line.x1);
        p.y1 = Math.max(p.y1, line.y1);
        added = true;
        break; // Bu satır balona eklendiği için çık
      }
    }

    // Yeni ve tamamen bağımsız bir satırsa, onu yeni bir baloncuk olarak ekle
    if (!added) {
      paragraphs.push({ ...line });
    }
  }

  return paragraphs;
}

export async function recognizeWithOCRSpace(imageSource: string, apiKey: string) {
  console.log("[OCR.Space] API işlemi başlıyor...");

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
      console.log("[OCR.Space] Base64 çevirisi başarılı.");
    } catch (e) {
      console.error("[OCR.Space] Base64 çeviri hatası:", e);
      throw new Error("Resim formatı API'ye uygun değil.");
    }
  }

  const formData = new FormData();
  formData.append("base64Image", base64Image);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "true");
  formData.append("OCREngine", "2");

  try {
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": apiKey,
      },
      body: formData,
    });

    const data = await response.json();
    console.log("[OCR.Space] API Yanıtı alındı:", data);

    if (data.IsErroredOnProcessing) {
      console.error("[OCR.Space] API İşlem Hatası:", data.ErrorMessage);
      throw new Error("OCR.Space Hatası: " + data.ErrorMessage);
    }

    const rawLines: BBoxLine[] = [];
    const parsedResults = data.ParsedResults?.[0];

    if (parsedResults && parsedResults.TextOverlay && parsedResults.TextOverlay.Lines) {
      for (const line of parsedResults.TextOverlay.Lines) {
        const text = line.LineText?.trim();
        
        if (!text || text.length < 2) continue; // Noise filtresi

        if (line.Words && line.Words.length > 0) {
          const lefts = line.Words.map((w: any) => w.Left as number);
          const tops = line.Words.map((w: any) => w.Top as number);
          const rights = line.Words.map((w: any) => (w.Left + w.Width) as number);
          const bottoms = line.Words.map((w: any) => (w.Top + w.Height) as number);

          rawLines.push({
            text,
            x0: Math.min(...lefts),
            y0: Math.min(...tops),
            x1: Math.max(...rights),
            y1: Math.max(...bottoms),
          });
        }
      }
    }

    // Ayrı ayrı bulunan tüm satırları baloncuk paragrafı haline dönüştür
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
      });
    }

    console.log(`[OCR.Space] ${rawLines.length} satır işlendi, ${results.length} baloncuk (paragraf) olarak birleştirildi.`);
    return results;
  } catch (error) {
    console.error("[OCR.Space] İletişim Hatası:", error);
    return [];
  }
}
