// app/ocr/Ocr_model.ts

export const OcrEngines = [
  { code: "ocrspace", name: "OCR.Space" },
  { code: "paddleocr", name: "PaddleOCR" },
  { code: "easyocr", name: "EasyOCR" }
];

export const PaddleOcrLanguages = [
  { code: "en", name: "İngilizce" },
  { code: "latin", name: "Latin Alfabesi" },
  { code: "fr", name: "Fransızca" },
  { code: "german", name: "Almanca" },
  { code: "japan", name: "Japonca" },
  { code: "ch", name: "Çince" },
  { code: "korean", name: "Korece" },
  { code: "arabic", name: "Arapça" },
  { code: "ru", name: "Kiril Alfabesi" },
];

export const EasyOcrLanguages = [
  { code: "latin", name: "Latin (EN/FR/DE/ES...)" },
  { code: "cyrillic", name: "Cyrillic (RU/UK/BG...)" },
  { code: "arabic", name: "Arabic (AR/FA/UR)" },
  { code: "chinese_simplified", name: "Chinese Simplified" },
  { code: "chinese_traditional", name: "Chinese Traditional" },
  { code: "japanese", name: "Japanese" },
  { code: "korean", name: "Korean" },
  { code: "hindi", name: "Hindi" },
];

export const OcrSpaceLanguages = [
  { code: "eng", name: "İngilizce (ENG)" },
  { code: "tur", name: "Türkçe (TUR)" },
  { code: "jpn", name: "Japonca (JPN)" },
  { code: "kor", name: "Korece (KOR)" },
  { code: "chs", name: "Çince Basitleştirilmiş (CHS)" },
  { code: "cht", name: "Çince Geleneksel (CHT)" },
];

// Aktif OCR motoruna göre uygun dil listesini döndüren yardımcı fonksiyon
export function getLanguagesForEngine(engineCode: string) {
    switch (engineCode) {
        case "paddleocr":
            return PaddleOcrLanguages;
        case "easyocr":
            return EasyOcrLanguages;
        case "ocrspace":
            return OcrSpaceLanguages;
        default:
            return [];
    }
}
