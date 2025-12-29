// api/services/conversionService.js
const pool = require('../db');

exports.processFile = async (file) => {
    console.log(`[Dönüştürücü] ${file.name} için işlem başlatıldı...`);

    try {
        // 1. Durumu 'processing' yap
        await pool.query(`UPDATE files SET conversion_status = 'processing' WHERE file_id = $1`, [file.file_id]);

        // 2. SİMÜLASYON: Gerçek dönüştürme işlemi burada yapılır.
        // Örn: Autodesk Forge API'ye dosya gönderilir, webhook beklenir.
        // Biz şimdilik 10 saniye bekleyip "Başarılı" diyelim.
        
        setTimeout(async () => {
            console.log(`[Dönüştürücü] ${file.name} dönüştürüldü!`);
            
            // Not: Gerçekte buraya dönüştürülen .glb dosyasının URL'i gelir.
            // Şimdilik demo amaçlı, eğer varsa bir örnek GLB url'i verebiliriz yoksa null kalır.
            // Frontend 'completed' görünce, eğer converted_url yoksa yine indir butonunu gösterir ama "Hazır" der.
            
            await pool.query(`
                UPDATE files 
                SET conversion_status = 'completed',
                    converted_url = $1 -- Buraya gerçek GLB linki gelecek
                WHERE file_id = $2
            `, [null, file.file_id]);

        }, 10000); // 10 saniye sürsün

    } catch (error) {
        console.error(`[Dönüştürücü Hatası]`, error);
        await pool.query(`UPDATE files SET conversion_status = 'failed' WHERE file_id = $1`, [file.file_id]);
    }
};