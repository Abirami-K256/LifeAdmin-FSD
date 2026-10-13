const { checkAndSendReminders } = require('../services/reminder.service');

// POST /api/reminders/trigger
// Manually triggers the expiry reminder check and sends emails
exports.triggerReminders = async (req, res, next) => {
  try {
    const summary = await checkAndSendReminders();
    res.status(200).json({
      success: true,
      message: 'Reminder job executed successfully.',
      summary,
    });
  } catch (err) {
    next(err);
  }
};
