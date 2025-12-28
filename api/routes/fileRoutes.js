// api/routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middleware/authMiddleware');

// --- GÖREV DOSYALARI ---
// Not: Göreve dosya yükleme rotası taskRoutes içinde tanımlı olabilir 
// veya frontend direkt fileController'ı çağırıyor olabilir.
// Ancak biz burada proje rotalarını tanımlayacağız.

// --- YENİ: PROJE PAFTALARI ---
// Projeye ait paftaları getir
router.get('/projects/:projectId/plans', authMiddleware, fileController.getProjectPlans);

// Projeye yeni pafta ekle
router.post('/projects/:projectId/plans', authMiddleware, fileController.addProjectPlan);

module.exports = router;