const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminder.controller');
const authenticateToken = require('../middleware/auth.middleware');

router.post('/trigger', authenticateToken, reminderController.triggerReminders);

module.exports = router;
