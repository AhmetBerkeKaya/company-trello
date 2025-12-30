// api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 1. Token var mı?
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Yetkilendirme başarısız: Token yok' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    if (!token) {
      return res.status(401).json({ message: 'Yetkilendirme başarısız: Token formatı hatalı' });
    }

    // 2. Token geçerli mi?
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. User bilgisini request'e ekle
    req.user = decoded; 
    // decoded şunları içerir: { userId, email, role, companyId, ... }

    next();
  } catch (error) {
    console.error('Auth middleware hatası:', error.message);
    return res.status(401).json({ message: 'Yetkilendirme başarısız: Geçersiz token' });
  }
};

// EKSTRA: Rol Kontrolü Middleware'leri (Route'larda kullanmak için)

// Sadece Şirket Personeli (Admin, Manager, User) girebilsin -> Müşteri giremez!
module.exports.restrictToStaff = (req, res, next) => {
    if (req.user.role === 'client') {
        return res.status(403).json({ message: 'Bu alana sadece şirket personeli erişebilir.' });
    }
    next();
};

// Sadece Yöneticiler
module.exports.restrictToAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekiyor.' });
    }
    next();
};

// Admin veya Manager
module.exports.restrictToManager = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    next();
};


module.exports.preventObserverWrite = (req, res, next) => {
  if (req.user.role === 'observer') {
    return res.status(403).json({ message: 'Gözlemci hesabı ile değişiklik yapamazsınız.' });
  }
  next();
};