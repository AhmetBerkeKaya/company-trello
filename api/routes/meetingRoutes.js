// api/routes/meetingRoutes.js
const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// ÖNEMLİ: Özel rotalar (upcoming gibi) her zaman parametreli rotalardan (:id) ÖNCE gelmelidir.
router.get('/upcoming', meetingController.getMyUpcomingMeetings);
router.get('/', meetingController.getMyAllMeetings);

// YENİ: POST /api/meetings (Yeni toplantı oluştur)
router.post('/', meetingController.createMeeting);

// YENİ: PUT /api/meetings/:meetingId (Toplantı düzenle)
router.put('/:meetingId', meetingController.updateMeeting);

module.exports = router;