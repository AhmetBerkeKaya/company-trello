// api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Giriş yapmanız gerekli' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token geçerli değil veya süresi dolmuş' });
    }
    
    // Token geçerli ama içinde şirket bilgisi var mı? (Eski tokenları engellemek için)
    if (!user.companyId) {
       return res.status(403).json({ message: 'Token formatı geçersiz (Şirket bilgisi eksik). Lütfen tekrar giriş yapın.' });
    }

    req.user = user;
    next();
  });
};

module.exports = authMiddleware;