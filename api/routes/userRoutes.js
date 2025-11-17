// api/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// (Tüm yollar giriş gerektirir)
router.use(authMiddleware);

// --- "Benimle" (Kişisel) İlgili Yollar ---
// (Bu yolların '/:userId'den ÖNCE gelmesi gerekir)

// GET /api/users/me/stats (Profilim İstatistikleri)
router.get('/me/stats', userController.getUserStats);

// PUT /api/users/me/profile (Profilimi Güncelle)
router.put('/me/profile', userController.updateUserProfile);

// PUT /api/users/me/password (Şifremi Güncelle)
router.put('/me/password', userController.updateUserPassword);

// PUT /api/users/me/settings (Ayarlarımı Güncelle)
router.put('/me/settings', userController.updateUserSettings);


// --- Diğer Kullanıcılarla İlgili Yollar ---

// GET /api/users (Tüm liste - Admin)
router.get('/', userController.getAllUsers);

// GET /api/users/role/managers (Tüm admin/manager'lar)
router.get('/role/managers', userController.getManagersAndAdmins);

// PUT /api/users/:userId/role (Rol güncelle - Admin)
router.put('/:userId/role', userController.updateUserRole);

// PUT /api/users/:userId/department (Departman güncelle - Admin)
router.put('/:userId/department', userController.updateUserDepartment);

// GET /api/users/:userId (Tek kullanıcı detayı - Herkes)
// (DİNAMİK YOL HEP EN SONDA OLMALI)
router.get('/:userId', userController.getUserById);

module.exports = router;