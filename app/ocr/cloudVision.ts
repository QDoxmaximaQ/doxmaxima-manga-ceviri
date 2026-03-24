// app/ocr/cloudVision.ts

export async function recognizeWithCloudVision(imageBase64: string) {
  // Google Cloud Vision API resme gönderilip Text Annotation üzerinden yazılar alınacak.
  // Yazıların koordinatlarını dönüştürüp, "merkez noktasını" ayarlayacağız.
  console.log("Google Cloud Vision API OCR başlatılıyor...");
  
  // Örnek bir geri dönüş
  return [
    { text: "Bulut Metin", centerX: 250, centerY: 300, width: 80, height: 25 }
  ];
}
