// api/routes/companyRoutes.js
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');

// (Tüm yollar giriş gerektirir)
router.use(authMiddleware);

// GET /api/companies (Tüm firmaları listele - İstatistikler dahil)
router.get('/', companyController.getAllCompanies);

// POST /api/companies (Yeni firma oluştur)
router.post('/', companyController.createCompany);

// YENİ: GET /api/companies/:companyId/projects (Bir firmanın proje geçmişi)
router.get('/:companyId/projects', companyController.getProjectsForCompany);

module.exports = router;