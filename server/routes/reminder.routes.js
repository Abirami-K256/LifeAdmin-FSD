const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminder.controller');
const authenticateToken = require('../middleware/auth.middleware');

// External cron trigger protected by x-cron-secret header (no JWT required)
router.post('/run', reminderController.runCronReminders);

// Internal user-authenticated test trigger (protected by JWT)
router.post('/trigger', authenticateToken, reminderController.triggerReminders);

module.exports = router;
