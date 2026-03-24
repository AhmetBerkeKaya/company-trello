// api/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// (Tüm yollar giriş gerektirir)
router.use(authMiddleware);

// --- "Benimle" (Kişisel) İlgili Yollar ---
router.get('/me/stats', userController.getUserStats);
router.put('/me/profile', userController.updateUserProfile);
router.put('/me/password', userController.updateUserPassword);
router.put('/me/settings', userController.updateUserSettings);

// --- Diğer Kullanıcılarla İlgili Yollar ---
// GET /api/users (Tüm liste - Admin)
router.get('/', userController.getAllUsers);

// POST /api/users (Kullanıcı Ekleme - Admin)
router.post('/', userController.createUser);

// YENİ: PUT ve DELETE işlemleri
router.put('/:userId', userController.updateUser);
router.delete('/:userId', userController.deleteUser);

// GET /api/users/role/managers (Tüm admin/manager'lar)
router.get('/role/managers', userController.getManagersAndAdmins);

// PUT /api/users/:userId/role (Rol güncelle - Admin)
router.put('/:userId/role', userController.updateUserRole);

// PUT /api/users/:userId/department (Departman güncelle - Admin)
router.put('/:userId/department', userController.updateUserDepartment);

// GET /api/users/:userId (Tek kullanıcı detayı - Herkes)
router.get('/:userId', userController.getUserById);

module.exports = router;