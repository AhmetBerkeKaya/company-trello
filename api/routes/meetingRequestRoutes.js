// api/routes/meetingRequestRoutes.js
const express = require('express');
const router = express.Router();
const meetingRequestController = require('../controllers/meetingRequestController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// POST /api/meeting-requests (User için)
router.post('/', meetingRequestController.createMeetingRequest);

// GET /api/meeting-requests (Admin/Manager için)
router.get('/', meetingRequestController.getAllMeetingRequests);

// PUT /api/meeting-requests/:id/approve (Admin/Manager için)
router.put('/:id/approve', meetingRequestController.approveMeetingRequest);

// PUT /api/meeting-requests/:id/reject (Admin/Manager için)
router.put('/:id/reject', meetingRequestController.rejectMeetingRequest);

module.exports = router;