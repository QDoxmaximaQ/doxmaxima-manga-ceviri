import cv2
import numpy as np
from simple_lama_inpainting import SimpleLama
from PIL import Image
import pillow_avif  # AVIF format desteği için gereklidir
import os

class MangaProcessor:
    def __init__(self):
        """
        Sınıf başlatıldığında LaMa modelini yükler ve AVIF desteğini doğrular.
        """
        # LaMa modelini yüklüyoruz.
        self.lama = SimpleLama()
        
        # --- IDE'DEKİ "KULLANILMIYOR" UYARISINI GİDERMEK VE DOĞRULAMAK İÇİN ---
        # pillow_avif sadece import edildiğinde Pillow'a register olur.
        # Burada ismini geçirerek hem IDE uyarısını siliyoruz hem de terminale bilgi basıyoruz.
        if pillow_avif:
            print("--- SISTEM: AVIF PLUGIN'I BASARIYLA YUKLENDI ---")

    def detect_text_blocks(self, image):
        """
        Görüntü üzerindeki metin bloklarını OpenCV kullanarak saptar.
        """
        # Görüntüyü gri tonlamaya çeviriyoruz
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Gürültüyü azaltmak için Gaussian Blur uyguluyoruz
        blur = cv2.GaussianBlur(gray, (7,7), 0)
        
        # Metin alanlarını belirginleştirmek için Thresholding uyguluyoruz
        thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        
        # Konturları buluyoruz
        cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        
        blocks = []
        for c in cnts:
            x, y, w, h = cv2.boundingRect(c)
            # Belirli bir boyuttan büyük alanları metin balonu olarak kabul et
            if w > 25 and h > 25: 
                blocks.append({"x": x, "y": y, "w": w, "h": h})
        return blocks

    def clean_and_format(self, image_path):
        """
        Resmi okur, metinleri saptar, maskeler ve LaMa ile temizler.
        """
        # --- GÜVENLİ OKUMA VE FORMAT GÜNCELLEMESİ ---
        # OpenCV (cv2.imread) doğrudan Türkçe/Özel karakterli yolları Windows'ta okuyamaz 
        # ve standart haliyle AVIF formatını desteklemez.
        # Bu yüzden önce PIL (Image.open) ile açıp sonra OpenCV formatına çeviriyoruz.
        try:
            # pillow-avif-plugin yüklü olduğu sürece Image.open AVIF dosyalarını okuyabilir.
            img_pil = Image.open(image_path).convert("RGB")
            # PIL görüntüsünü OpenCV'nin işleyebileceği numpy array formatına (BGR) çeviriyoruz.
            img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        except Exception as e:
            # Hata durumunda terminale detaylı bilgi basıyoruz
            print(f"Resim okuma veya format hatası (AVIF desteğini kontrol edin): {e}")
            raise ValueError(f"Dosya okunamadı veya format desteklenmiyor: {image_path}")
        
        if img_cv is None or img_cv.size == 0:
            raise ValueError("Görüntü verisi boş döndü!")

        # 1. Metinleri Saptama
        blocks = self.detect_text_blocks(img_cv)
        
        # 2. Maske Oluşturma (Senin istediğin 2-3 piksel pay ile)
        mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)
        padding = 3 # Dilation payı
        
        text_layers = []
        for i, b in enumerate(blocks):
            # Maske üzerinde metin alanını genişleterek çiz (Dilation mantığı)
            cv2.rectangle(mask, 
                          (max(0, b["x"] - padding), max(0, b["y"] - padding)), 
                          (min(img_cv.shape[1], b["x"] + b["w"] + padding), min(img_cv.shape[0], b["y"] + b["h"] + padding)), 
                          255, -1)
            
            # Frontend tarafındaki 'metin.tsx' yapısına uygun katman verisi oluştur
            text_layers.append({
                "id": f"ai-layer-{i}-{os.urandom(4).hex()}", # Benzersiz ID üretimi
                "name": f"Metin {i+1}",
                "text": "", 
                "textConfig": {
                    "x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"],
                    "fontSize": 22, "color": "#000000", "fontFamily": "Arial"
                }
            })

        # 3. LaMa ile Inpainting (Arka Plan Temizleme)
        # LaMa, maske çevresindeki orijinal dokuyu kullanarak temizleme yapar.
        mask_pil = Image.fromarray(mask)
        result_pil = self.lama(img_pil, mask_pil)
        
        # Sonucu temizlenmiş dosya adı ile 'uploads' klasörüne kaydet
        # AVIF girdi olsa bile çıktı web uyumluluğu için PNG olarak kaydedilir.
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        cleaned_filename = f"cleaned_{base_name}.png"
        cleaned_path = os.path.join(os.path.dirname(image_path), cleaned_filename)
        result_pil.save(cleaned_path)
        
        return text_layers, cleaned_filename