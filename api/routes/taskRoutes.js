// api/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController'); // YENİ
const fileController = require('../controllers/fileController');       // YENİ
const authMiddleware = require('../middleware/authMiddleware');

// === Ana Görev Yolları ===
// GET /api/tasks/my (Dashboard için)
router.get('/my', authMiddleware, taskController.getMyTasks);

// POST /api/tasks (Yeni görev oluştur - Column.js)
router.post('/', authMiddleware, taskController.createTask);

// PUT /api/tasks/:taskId/status (Kanban Drag-and-Drop)
router.put('/:taskId/status', authMiddleware, taskController.updateTaskStatus);

// PUT /api/tasks/:taskId (Görev detaylarını güncelle - TaskDetailModal)
router.put('/:taskId', authMiddleware, taskController.updateTaskDetails);

// === Yorum Yolları ===
// GET /api/tasks/:taskId/comments (Yorumları listele)
router.get('/:taskId/comments', authMiddleware, commentController.getCommentsForTask);

// POST /api/tasks/:taskId/comments (Yorum ekle)
router.post('/:taskId/comments', authMiddleware, commentController.addCommentToTask);

// === Dosya Yolları ===
// GET /api/tasks/:taskId/files (Dosyaları listele)
router.get('/:taskId/files', authMiddleware, fileController.getFilesForTask);

// POST /api/tasks/:taskId/files (Dosya kaydı ekle)
router.post('/:taskId/files', authMiddleware, fileController.addFileRecord);

router.delete('/:taskId', authMiddleware, taskController.deleteTask);

router.put('/:taskId/location', authMiddleware, taskController.updateTaskLocation);

module.exports = router;