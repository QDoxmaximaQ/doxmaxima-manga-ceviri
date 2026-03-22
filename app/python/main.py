from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from processor import MangaProcessor
import os
import uvicorn

app = FastAPI()

# --- CORS AYARLARI ---
# Tarayıcı tarafındaki (Next.js - 3000 portu) 'Access-Control-Allow-Origin' hatalarını önlemek için 
# bu ayarların uygulama başlatılırken en başta tanımlanması kritiktir.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# İşlemci sınıfını başlatıyoruz.
processor = MangaProcessor()

# --- KLASÖR KONTROLÜ ---
# Uygulama başlamadan önce uploads klasörünün varlığından emin oluyoruz.
# FastAPI StaticFiles, dizin yoksa hata fırlatacağı için bu kontrol zorunludur.
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@app.post("/auto-process")
async def auto_process(file: UploadFile = File(...)):
    """
    Frontend'den gelen manga sayfasını alır, temizler ve metin katmanlarını döner.
    """
    # 1. DOSYA ADI TEMİZLİĞİ: Windows dosya yolu hatalarını önlemek için boşlukları temizle.
    safe_filename = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # Mevcut aynı isimli bir dosya varsa, kilitlenme olmaması için temizliyoruz.
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except:
            pass

    try:
        # Dosya içeriğini asenkron olarak oku ve diske yaz.
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # 2. İŞLE: Saptama + Maskeleme + LaMa Inpainting
        # Bu fonksiyon, processor.py içindeki güvenli okuma (Pillow) yöntemini kullanır.
        layers, cleaned_img_name = processor.clean_and_format(file_path)
        
        # 3. BAŞARILI SONUÇLARI DÖN
        # Metin katmanları ve temizlenmiş resmin tam URL'si döner.
        return {
            "status": "success",
            "layers": layers,
            "cleaned_image_url": f"http://localhost:8000/uploads/{cleaned_img_name}"
        }
        
    except Exception as e:
        # HATA DURUMU: Sunucunun çökmesini ve CORS hatası vermesini engeller.
        # Hatayı terminale yazdırıp frontend'e JSON olarak gönderiyoruz.
        print(f"KRİTİK HATA: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

# STATİK DOSYA ERİŞİMİ
# uploads klasöründeki resimleri URL üzerinden (http://localhost:8000/uploads/...) dışarı açar.
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    # Sunucuyu 8000 portunda başlatıyoruz.
    uvicorn.run(app, host="0.0.0.0", port=8000)