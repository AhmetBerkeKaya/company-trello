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

// GET /api/companies/:companyId/projects (Bir firmanın proje geçmişi)
router.get('/:companyId/projects', companyController.getProjectsForCompany);

// POST /api/companies/bulk (Toplu yükleme)
router.post('/bulk', authMiddleware, companyController.bulkCreateCompanies);

// PUT /api/companies/:id (Firmayı güncelle - YENİ EKLENDİ)
router.put('/:id', companyController.updateCompany);

// DELETE /api/companies/:id (Firmayı sil - YENİ EKLENDİ)
router.delete('/:id', companyController.deleteCompany);

module.exports = router;