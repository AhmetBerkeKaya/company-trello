// api/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');
const fileController = require('../controllers/fileController');


router.use(authMiddleware);

// GET /api/projects (Tüm projelerim)
router.get('/', projectController.getMyProjects);

// POST /api/projects (Yeni proje oluştur)
router.post('/', projectController.createProject);

// GET /api/projects/:projectId/members (Üyeleri getir)
router.get('/:projectId/members', projectController.getProjectMembers);

// GET /api/projects/:projectId/stats (İstatistikleri getir)
router.get('/:projectId/stats', projectController.getProjectStats);

// GET /api/projects/:projectId/tasks (Kanban görevlerini getir)
router.get('/:projectId/tasks', projectController.getTasksForProject);

// PUT /api/projects/:projectId/status (Durumu güncelle)
router.put('/:projectId/status', projectController.updateProjectStatus);

router.put('/:projectId', authMiddleware, projectController.updateProject);

// YENİ: PUT /api/projects/:projectId/members (Üyeleri güncelle)
router.put('/:projectId/members', projectController.updateProjectMembers);

// DELETE /api/projects/:projectId (Projeyi sil)
router.delete('/:projectId', projectController.deleteProject);

// GET /api/projects/:projectId (Proje detayını getir)
// (Bu hep en sonda kalmalı)
router.get('/:projectId', projectController.getProjectById);

// Proje Paftalarını Getir (Artık adres: /api/projects/:projectId/plans olacak)
router.get('/:projectId/plans', authMiddleware, fileController.getProjectPlans);

// Projeye Yeni Pafta Ekle
router.post('/:projectId/plans', authMiddleware, fileController.addProjectPlan);

router.post('/:projectId/folders', fileController.createFolder);

module.exports = router;