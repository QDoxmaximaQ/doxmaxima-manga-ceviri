// app/ocr/easyocr.ts

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

export async function recognizeWithEasyOCR(imageSource: string, endpointUrl: string) {
  console.log("[EasyOCR] İstek başlıyor...");

  if (!endpointUrl) throw new Error("EasyOCR Endpoint URL tanımlanmamış. Ayarlardan kontrol edin.");

  let formattedUrl = endpointUrl.replace(/\/api\/predict$/, '').replace(/\/run\/predict$/, '').replace(/\/call\/predict$/, '').replace(/\/$/, '');
  console.log(`[EasyOCR] Kullanılacak Hedef Root URL: ${formattedUrl}`);

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
    } catch (e) {
      throw new Error("Resim formatı çözülemedi.");
    }
  }

  try {
    const { Client, handle_file } = await import("@gradio/client");
    const app = await Client.connect(formattedUrl);

    const base64Response = await fetch(base64Image);
    const imageBlob = await base64Response.blob();
    const imageFile = new File([imageBlob], "manga_page.png", { type: "image/png" });

    const userLang = (typeof window !== 'undefined' && localStorage.getItem("easyOcrLang")) || "latin";
    
    // YENİ KEŞİF: HF Sunucunuz dil seçimi olarak PaddleOCR ile BİREBİR aynı string anahtarlarını bekliyor!
    const langMap: Record<string, string> = {
      "latin": "latin",
      "cyrillic": "cyrillic",
      "arabic": "arabic",
      "chinese_simplified": "ch",
      "chinese_traditional": "ch",
      "japanese": "japan",
      "korean": "korean",
      "hindi": "latin" // (Eğer backend 'hindi' tanımıyorsa latin olarak düşer)
    };
    const mappedLang = langMap[userLang] || "latin";
    
    console.log(`[EasyOCR] Sunucuya istek atılıyor (Gönderilen Dil: ${mappedLang})`);
    
    // NOT: Kullanıcı "Doxmaxima/EasyOCR-v1" veya "doxmaxima-easyocr-v1" HF linkini kullanmalıdır.
    // Başka klonlanmış HF space (tomofi vb.) bu formata veya bu isimlere sahip değildir!
    
    // DİNAMİK UÇ NOKTA SEÇİCİ: Gradio sunucusunun bize sunduğu endpointler arasında "Yapay Zeka Okuması" yapanını bul:
    const deps = app.config?.dependencies || [];
    let targetFnId: number | string = "/predict";
    
    for (const d of deps) {
       // OCR yapay zekamız 2 parametre bekler: Resim (file/image) ve Dil (string). 
       // Bu yüzden 2'den fazla input kabul eden ilk ana işlevi hedefleriz:
       if (d.inputs && d.inputs.length >= 2) {
           targetFnId = d.id; // Örneğin tomofi-copy'de bu "2" numaradır, Doxmaxima'da "0" numaradır!
           console.log(`[EasyOCR] Hedef uç nokta dinamik olarak bulundu -> fn_index: ${targetFnId} (API: ${d.api_name || "Bilinmiyor"})`);
           break;
       }
    }
    
    let result;
    try {
      result = await app.predict(targetFnId, [handle_file(imageFile), mappedLang]);
    } catch (e: any) {
      console.warn(`[EasyOCR] Seçili endpoint (${targetFnId}) başarısız oldu, "/predict" deneniyor... Hata: ${e.message}`);
      result = await app.predict("/predict", [handle_file(imageFile), mappedLang]);
    }

    const data = result as any;
    console.log("[EasyOCR] API'den Dönüş Alındı:", JSON.stringify(data).substring(0, 1000));
    
    const rawLines: BBoxLine[] = [];
    let predictions: any[] = [];

    // Gradio versiyonuna veya HF space'ine göre verinin yapısı { data: [...] } olabileceği gibi
    // Doğrudan [...] array olarak da dönebilir. (Kullanıcının space'i doğrudan Array dönüyor!)
    if (Array.isArray(data)) {
      // API dönüşü direkt bir Liste (Array) ise
      const candidate = data;
      // Eğer [ [ [ [x,y] ] ] ] formatındaysa fazla iç içe girmiş olabiliriz, ilk katmanı kontrol edelim:
      if (candidate.length > 0 && Array.isArray(candidate[0]) && candidate[0].length === 1 && Array.isArray(candidate[0][0])) {
         predictions = candidate[0];
      } else {
         predictions = candidate;
      }
    } else if (data && data.data && Array.isArray(data.data)) {
      // Eski yapı { data: [...] }
      const candidate = data.data;
      if (candidate.length > 0 && Array.isArray(candidate[0])) {
          if (Array.isArray(candidate[0][0]) && Array.isArray(candidate[0][0][0]) && typeof candidate[0][0][0][0] === "number") {
             predictions = candidate[0]; // [ [ [ [x,y] ] ] ]
          } else {
             predictions = candidate[0];
          }
      } else {
          predictions = candidate;
      }
    }

    // Eğer predictions bir obje barındırıyorsa ama bizim format [['text', ..]] ise, en doğru seviyeyi bulalım
    if (predictions.length > 0 && Array.isArray(predictions[0]) && Array.isArray(predictions[0][0]) && typeof predictions[0][0][0] === "number") {
         // [ [x,y], [x,y]... ] formatındaysa bu direkt olarak tek bir sonuçtur, array of results değildir.
         predictions = [predictions];
    }

    if (predictions && Array.isArray(predictions)) {
      for (const item of predictions) {
        if (!item || item.length < 2) continue;
        const box = item[0];
        const textInfo = item[1];
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

    return results;
  } catch (error) {
    console.error("[EasyOCR] İletişim Hatası:", error);
    return [];
  }
}
