// api/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/reports/project/:projectId
router.get('/project/:projectId', authMiddleware, reportController.generateProjectReport);

module.exports = router;