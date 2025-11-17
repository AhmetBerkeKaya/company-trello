// api/routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middleware/authMiddleware');

// YENİ: DELETE /api/files/:fileId (Dosya kaydını sil)
router.delete('/:fileId', authMiddleware, fileController.deleteFileRecord);

module.exports = router;