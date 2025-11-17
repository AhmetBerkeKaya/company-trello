// api/addTestManager.js
const pool = require('./db');
const bcrypt = require('bcryptjs');

// --- Burayı istediğiniz gibi değiştirebilirsiniz ---
const MANAGER_EMAIL = 'proje@proaec.com';
const MANAGER_PASSWORD = '123456'; // Test için basit bir şifre
const MANAGER_NAME = 'Proje Yöneticisi';
const MANAGER_DEPARTMENT = 'Teknik Ofis';
// ------------------------------------------------

async function addManager() {
  console.log('bcrypt yükleniyor...');
  // Şifreyi hash'le
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(MANAGER_PASSWORD, salt);
  console.log('Şifre hash\'lendi.');

  try {
    // Veritabanına 'manager' rolüyle ekle
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id, email, role`,
      [MANAGER_EMAIL, passwordHash, MANAGER_NAME, 'manager', MANAGER_DEPARTMENT]
    );

    if (result.rows.length > 0) {
      console.log('Manager kullanıcısı başarıyla oluşturuldu:', result.rows[0]);
    } else {
      console.log('Kullanıcı zaten mevcut olabilir (email: ' + MANAGER_EMAIL + ')');
    }
  } catch (error) {
    console.error('Kullanıcı oluşturulurken hata oluştu:', error);
  } finally {
    await pool.end(); // Bağlantıyı kapat
  }
}

addManager();