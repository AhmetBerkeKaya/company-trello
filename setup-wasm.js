// setup-wasm.js
const fs = require('fs');
const path = require('path');

// Kaynak ve Hedef Yollar
const sourceDir = path.join(__dirname, 'node_modules', 'web-ifc');
const targetDir = path.join(__dirname, 'public', 'wasm');

// Dosyalar
const filesToCopy = ['web-ifc.wasm', 'web-ifc-mt.wasm'];

// Hedef klasör yoksa oluştur
if (!fs.existsSync(targetDir)){
    console.log('📂 public/wasm klasörü oluşturuluyor...');
    fs.mkdirSync(targetDir, { recursive: true });
}

// Kopyalama İşlemi
filesToCopy.forEach(file => {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);

    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Başarılı: ${file} kopyalandı.`);
    } else {
        console.error(`❌ Hata: ${file} bulunamadı! 'npm install web-ifc' yaptın mı?`);
    }
});

console.log('🎉 IFC kurulumu tamamlandı!');