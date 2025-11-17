// api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Bu bizim "kapı görevlimiz"
const authMiddleware = (req, res, next) => {
  // 1. İsteğin header'ından "Authorization" bilgisini al
  const authHeader = req.headers['authorization'];
  
  // 2. Header "Bearer <token>" formatında mı? Değilse token yoktur.
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    // 401 Unauthorized (Kimlik doğrulanmamış)
    return res.status(401).json({ message: 'Giriş yapmanız gerekli' });
  }

  // 3. Token'ı doğrula (JWT_SECRET ile)
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // 403 Forbidden (Token geçerli değil veya süresi dolmuş)
      return res.status(403).json({ message: 'Token geçerli değil' });
    }
    
    // 4. Token geçerliyse:
    // İsteğin (req) içine 'user' objesini ekle.
    // Artık tüm "korumalı" yollarımız req.user diyerek
    // { userId: '...', role: '...', email: '...' } bilgilerine erişebilir.
    req.user = user;
    
    // 5. Bir sonraki adıma (asıl controller'a) "Devam et" de.
    next();
  });
};

module.exports = authMiddleware;