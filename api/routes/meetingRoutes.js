// api/routes/meetingRoutes.js
const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/', meetingController.getMyAllMeetings);
router.get('/upcoming', meetingController.getMyUpcomingMeetings);

// YENİ: POST /api/meetings (Yeni toplantı oluştur)
router.post('/', meetingController.createMeeting);

// YENİ: PUT /api/meetings/:meetingId (Toplantı düzenle)
router.put('/:meetingId', meetingController.updateMeeting);

module.exports = router;