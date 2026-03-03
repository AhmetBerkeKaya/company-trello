// api/db.js
const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

// --- 🛠️ NÜKLEER ÇÖZÜM: DNS LOOKUP HACK (MONKEY PATCH) ---
// Node.js'in standart DNS arama fonksiyonunu "hack"liyoruz.
// Veritabanı sunucusuna bağlanırken IPv6'yı tamamen yasaklıyoruz.
const originalLookup = dns.lookup;

dns.lookup = (hostname, options, callback) => {
  // Sadece bizim veritabanı adresi aranıyorsa müdahale et
  if (hostname === process.env.DB_HOST) {
    // console.log(`🔒 DNS Müdahalesi: ${hostname} için SADECE IPv4 aranıyor...`);
    
    // Parametreleri düzelt (options bazen gelmeyebilir)
    if (typeof options === 'function') {
      callback = options;
      options = { family: 4 }; // family: 4 demek "Sadece IPv4" demektir
    } else if (typeof options === 'object') {
      options.family = 4;
    } else {
      options = { family: 4 };
    }
  }
  
  // Orijinal fonksiyonu, bizim zorladığımız ayarlarla çağır
  return originalLookup(hostname, options, callback);
};
// -----------------------------------------------------------

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // 6543 olmalı (Environment'dan gelecek)
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 20000, // Süreyi biraz daha uzattık (20sn)
});

pool.on('error', (err) => {
  console.error('🔥 Veritabanı Havuz Hatası:', err.message);
});

module.exports = pool;