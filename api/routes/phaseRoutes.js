// api/routes/phaseRoutes.js
const express = require('express');
const router = express.Router();
const phaseController = require('../controllers/phaseController');
const authMiddleware = require('../middleware/authMiddleware');

// Projeye ait fazları getir
router.get('/projects/:projectId/phases', authMiddleware, phaseController.getPhases);

// Yeni faz ekle
router.post('/projects/:projectId/phases', authMiddleware, phaseController.createPhase);

// Faz güncelle
router.put('/:phaseId', authMiddleware, phaseController.updatePhase);

// Faz sil
router.delete('/:phaseId', authMiddleware, phaseController.deletePhase);

module.exports = router;