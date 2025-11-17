// api/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login
// Gelen isteği authController'daki loginUser fonksiyonuna yönlendirir.
router.post('/login', authController.loginUser);

// TODO: /register (kapalı), /change-password (sonra eklenecek)

module.exports = router;