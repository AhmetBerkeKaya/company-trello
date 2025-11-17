// api/controllers/authController.js
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.loginUser = async (req, res) => {
  // 1. React'tan gelen email ve password'ü al
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-posta ve şifre gereklidir' });
  }

  try {
    // 2. Veritabanında bu email'e sahip kullanıcıyı bul
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    // 3. Kullanıcı var mı?
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'auth/user-not-found' }); // React kodunla uyumlu hata
    }

    const user = userResult.rows[0];

    // 4. Şifre doğru mu? (Gelen şifre ile hash'lenmiş şifreyi karşılaştır)
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'auth/wrong-password' }); // React kodunla uyumlu hata
    }

    // 5. Şifre doğruysa, AuthContext'teki 'lastLoginAt' güncellemesini yap
    // (Bunu arka planda yap, kullanıcının beklemesine gerek yok)
    pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // 6. Kullanıcıya özel bir JWT (Token) oluştur
    // Bu token, kullanıcının "kimlik kartı" olacak
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.name,  // YENİ
      role: user.role   // YENİ
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '3d' } // Token 3 gün geçerli olsun
    );

    // 7. React'a (AuthContext'e) token'ı ve kullanıcı bilgilerini gönder
    // Not: Asla şifre hash'ini geri gönderme!
    delete user.password_hash;
    
    res.status(200).json({
      message: 'Giriş başarılı',
      token: token,
      userData: user // AuthContext'teki 'userData' state'i için
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};