import { createWorker } from 'tesseract.js';

export async function recognizeWithTesseract(imageSource: string) {
  console.log("Tesseract.js OCR başlatılıyor...");
  
  // Şimdilik Japonca ve İngilizce modellerini yüklüyoruz
  const worker = await createWorker('jpn+eng');
  const { data } = await worker.recognize(imageSource);
  await worker.terminate();

  const blocks = data?.blocks || [];

  // Mangalardaki yazılar blok olarak daha iyi yakalanır
  const results = blocks.map((block: any) => {
    const { x0, y0, x1, y1 } = block.bbox;
    const width = x1 - x0;
    const height = y1 - y0;
    const centerX = x0 + width / 2;
    const centerY = y0 + height / 2;
    return {
      text: block.text.trim(),
      centerX,
      centerY,
      width,
      height,
      // Seçim alanını da saklayalım ki ileride kutuyu çizelim
      bbox: block.bbox
    };
  }).filter((b: any) => b.text.length > 0);

  console.log(`Tesseract ${results.length} blok buldu.`);
  return results;
}
