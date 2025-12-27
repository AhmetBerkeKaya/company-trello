// api/routes/columnRoutes.js
const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');
const authMiddleware = require('../middleware/authMiddleware');

// Projeye ait sütunları getir
router.get('/projects/:projectId/columns', authMiddleware, columnController.getColumns);

// Yeni sütun ekle
router.post('/projects/:projectId/columns', authMiddleware, columnController.createColumn);

// Sütun güncelle (İsim)
router.put('/columns/:columnId', authMiddleware, columnController.updateColumn);

// Sütun sil
router.delete('/columns/:columnId', authMiddleware, columnController.deleteColumn);

router.put('/projects/:projectId/columns/reorder', authMiddleware, columnController.reorderColumns);

module.exports = router;