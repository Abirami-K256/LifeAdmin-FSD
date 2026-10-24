const { checkAndSendReminders } = require('../services/reminder.service');

// POST /api/reminders/trigger
// Manually triggers the expiry reminder check for authenticated user
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

// POST /api/reminders/run
// Protected by x-cron-secret header matching CRON_SECRET env var (for external cron jobs)
exports.runCronReminders = async (req, res, next) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const clientSecret = req.headers['x-cron-secret'];

    if (!cronSecret || clientSecret !== cronSecret) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or missing x-cron-secret header.',
      });
    }

    const summary = await checkAndSendReminders();
    res.status(200).json({
      success: true,
      message: 'Reminder job executed successfully.',
      sent: summary.sent,
      summary,
    });
  } catch (err) {
    next(err);
  }
};
