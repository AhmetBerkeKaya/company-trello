// api/controllers/authController.js
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-posta ve şifre gereklidir' });
  }

  try {
    // 1. Kullanıcıyı VE Şirket durumunu sorgula
    // JOIN kullanarak kullanıcının bağlı olduğu şirketin aktif olup olmadığını da kontrol ediyoruz.
    const query = `
      SELECT u.*, c.is_active as company_is_active, c.subscription_plan 
      FROM users u
      JOIN companies c ON u.company_id = c.company_id
      WHERE u.email = $1
    `;
    
    const userResult = await pool.query(query, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'auth/user-not-found' });
    }

    const user = userResult.rows[0];

    // 2. Şirket Aktif mi Kontrolü (SaaS Güvenliği)
    if (user.company_is_active === false) {
      return res.status(403).json({ message: 'Şirket hesabınız askıya alınmıştır. Lütfen yöneticiyle iletişime geçin.' });
    }

    // 3. Şifre Kontrolü
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'auth/wrong-password' });
    }

    // 4. Son giriş zamanını güncelle
    pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // 5. Token Oluştur (İçine Şirket Kimliğini de Gömüyoruz!)
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.company_id // KRİTİK EKLEME: Artık her istekte şirket ID'si taşınacak
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    // 6. Response Hazırla (Hassas verileri temizle)
    delete user.password_hash;
    
    res.status(200).json({
      message: 'Giriş başarılı',
      token: token,
      userData: {
        ...user,
        subscriptionPlan: user.subscription_plan // Frontend'de özellikleri kısıtlamak için kullanabiliriz
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};