// api/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

// (Tüm yollar giriş gerektirir)
router.use(authMiddleware);

// GET /api/notifications (Tümünü listele)
router.get('/', notificationController.getNotifications);

// POST /api/notifications/read-all (Tümünü okundu yap)
router.post('/read-all', notificationController.markAllNotificationsAsRead);

// POST /api/notifications/:notificationId/read (Tekil okundu yap)
router.post('/:notificationId/read', notificationController.markNotificationAsRead);

// Dosyanın alt kısımlarına şu satırı ekle:
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;