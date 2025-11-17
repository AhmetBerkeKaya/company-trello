// api/addTestUser.js
// api/addTestUser.js
const pool = require('./db'); // <--- DOĞRU SATIR
const bcrypt = require('bcryptjs');

// --- Burayı istediğiniz gibi değiştirebilirsiniz ---
const USER_EMAIL = 'berke@proaec.com.tr';
const USER_PASSWORD = '123456'; // Test için basit bir şifre
const USER_NAME = 'Ahmet Berke KAYA';
const USER_DEPARTMENT = 'Yazılım Geliştirme';
// ------------------------------------------------

async function addUser() {
  console.log('bcrypt yükleniyor...');
  // Şifreyi hash'le
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(USER_PASSWORD, salt);
  console.log('Şifre hash\'lendi.');

  try {
    // Veritabanına 'user' rolüyle ekle
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id, email, role`,
      [USER_EMAIL, passwordHash, USER_NAME, 'user', USER_DEPARTMENT]
    );

    if (result.rows.length > 0) {
      console.log('User (Kullanıcı) başarıyla oluşturuldu:', result.rows[0]);
    } else {
      console.log('Kullanıcı zaten mevcut olabilir (email: ' + USER_EMAIL + ')');
    }
  } catch (error) {
    console.error('Kullanıcı oluşturulurken hata oluştu:', error);
  } finally {
    await pool.end(); // Bağlantıyı kapat
  }
}

addUser();