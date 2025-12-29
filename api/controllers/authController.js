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
    // 1. SORGUNUN GÜNCELLENMESİ:
    // Şirketin 'logo_url' ve 'brand_color' bilgilerini de çekiyoruz.
    const query = `
      SELECT 
        u.*, 
        c.is_active as company_is_active, 
        c.subscription_plan,
        c.logo_url,        -- YENİ
        c.brand_color,     -- YENİ
        c.name as company_name -- YENİ (Navbar'da isim göstermek istersek)
      FROM users u
      JOIN companies c ON u.company_id = c.company_id
      WHERE u.email = $1
    `;
    
    const userResult = await pool.query(query, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'auth/user-not-found' });
    }

    const user = userResult.rows[0];

    // 2. Şirket Aktif mi Kontrolü
    if (user.company_is_active === false) {
      return res.status(403).json({ message: 'Şirket hesabınız askıya alınmıştır.' });
    }

    // 3. Şifre Kontrolü
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'auth/wrong-password' });
    }

    // 4. Son giriş zamanını güncelle
    pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    // 5. Token Oluştur
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.company_id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3d' });

    delete user.password_hash;
    
    // 6. Response (userData içinde artık logo ve renk de var)
    res.status(200).json({
      message: 'Giriş başarılı',
      token: token,
      userData: {
        ...user,
        subscriptionPlan: user.subscription_plan
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};