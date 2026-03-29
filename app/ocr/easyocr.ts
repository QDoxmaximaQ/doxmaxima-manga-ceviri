// app/ocr/easyocr.ts

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

export async function recognizeWithEasyOCR(imageSource: string, endpointUrl: string) {
  console.log("[EasyOCR] İstek başlıyor...");

  if (!endpointUrl) throw new Error("EasyOCR Endpoint URL tanımlanmamış. Ayarlardan kontrol edin.");

  let formattedUrl = endpointUrl.replace(/\/api\/predict$/, '').replace(/\/run\/predict$/, '').replace(/\/call\/predict$/, '').replace(/\/$/, '');
  console.log(`[EasyOCR] Kullanılacak Hedef Root URL: ${formattedUrl}`);

  // --- HUGGING FACE SPACE DURUM KONTROLÜ (RUNNING MI?) ---
  console.log(`[EasyOCR] Space çalışma durumu kontrol ediliyor...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 sn içinde yanıt vermezse kapalı/building say

    // Gradio sunucusu eğer 'Running' ise /config yolundan saf JSON döner.
    const configRes = await fetch(`${formattedUrl}/config`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!configRes.ok) {
      throw new Error(`Space hazır değil (HTTP ${configRes.status})`);
    }

    const configText = await configRes.text();
    JSON.parse(configText); // JSON parse edilemiyorsa HTML dönmüştür (Building/Sleeping ekranı)
  } catch (checkError) {
    console.warn("[EasyOCR] HuggingFace Repo Kontrol Başarısız:", checkError);
    throw new Error("HF_NOT_RUNNING");
  }

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

    return results;
  } catch (error: any) {
    console.error("[EasyOCR] İletişim Hatası:", error);
    throw new Error("HuggingFace Error: " + (error.message || "Bilinmeyen Hata"));
  }
}
