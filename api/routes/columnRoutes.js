// api/routes/columnRoutes.js
const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');
const authMiddleware = require('../middleware/authMiddleware');

// DİKKAT: Artık URL yapımız /phases/:phaseId/columns şeklinde olacak.
// Bu dosya index.js'de nasıl çağrıldığına bağlı olarak değişebilir ama 
// en temiz yöntem burayı "mergeParams: true" yapmaktır veya direkt full path vermektir.

// 1. Bir fazdaki sütunları getir
router.get('/phases/:phaseId/columns', authMiddleware, columnController.getColumns);

// 2. Faza yeni sütun ekle
router.post('/phases/:phaseId/columns', authMiddleware, columnController.createColumn);

// 3. Sütun sıralamasını güncelle (Phase ID gerekli)
router.put('/phases/:phaseId/columns/reorder', authMiddleware, columnController.reorderColumns);

// --- Aşağıdakiler ID bazlı olduğu için path değişmedi ---

// 4. Sütun adı güncelle
router.put('/columns/:columnId', authMiddleware, columnController.updateColumn);

// 5. Sütun sil
router.delete('/columns/:columnId', authMiddleware, columnController.deleteColumn);

module.exports = router;