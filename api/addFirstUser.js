// api/addFirstUser.js
const pool = require('./db');
const bcrypt = require('bcryptjs');

// Burayı kendi bilgilerinizle veya 16 kişilik listeden ilk kişiyle değiştirin
const FIRST_ADMIN_EMAIL = 'admin@proaec.com';
const FIRST_ADMIN_PASSWORD = 'adminSifresi123'; // Güçlü bir şifre seçin
const FIRST_ADMIN_NAME = 'Şirket Sahibi (Admin)';

async function addAdmin() {
  console.log('bcrypt yükleniyor...');
  // Şifreyi hash'le (asla düz metin kaydetme)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(FIRST_ADMIN_PASSWORD, salt);
  console.log('Şifre hash\'lendi.');

  try {
    // Veritabanına ekle
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id, email, role`,
      [FIRST_ADMIN_EMAIL, passwordHash, FIRST_ADMIN_NAME, 'admin', 'Yönetim']
    );

    if (result.rows.length > 0) {
      console.log('Admin kullanıcısı başarıyla oluşturuldu:', result.rows[0]);
    } else {
      console.log('Kullanıcı zaten mevcut olabilir (email: ' + FIRST_ADMIN_EMAIL + ')');
    }
  } catch (error) {
    console.error('Kullanıcı oluşturulurken hata oluştu:', error);
  } finally {
    await pool.end(); // Bağlantıyı kapat
  }
}

addAdmin();