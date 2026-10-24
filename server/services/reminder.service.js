const cron = require('node-cron');
const Document = require('../models/Document');
const User = require('../models/User');

/**
 * Sends a stylized reminder email to the document owner via Brevo HTTPS API.
 * Falls back to console logging in development if Brevo credentials are not configured.
 */
async function sendExpiryEmail(userEmail, userName, docTitle, category, expiryDate, daysLeft) {
  // Format calendar date without timezone shift
  const exp = new Date(expiryDate);
  const day = String(exp.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${day} ${months[exp.getUTCMonth()]} ${exp.getUTCFullYear()}`;

  const urgencyText = daysLeft <= 0 ? 'Expires Today!' : daysLeft === 1 ? 'Expires Tomorrow!' : `Expires in ${daysLeft} days`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="background-color: #023047; padding: 15px; border-radius: 6px 6px 0 0; color: white;">
        <h2 style="margin: 0; font-size: 20px;">LifeAdmin - Expiry Reminder</h2>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello <strong>${userName}</strong>,</p>
        <p>This is an automated reminder that your document is expiring soon:</p>
        <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">${docTitle}</h3>
          <p style="margin: 4px 0; color: #64748b;"><strong>Category:</strong> ${category}</p>
          <p style="margin: 4px 0; color: #64748b;"><strong>Expiry Date:</strong> ${formattedDate}</p>
          <p style="margin: 4px 0; color: #d97706; font-weight: bold;"><strong>Urgency:</strong> ${urgencyText}</p>
        </div>
        <p>Please take the necessary steps to renew or update your document in time.</p>
        <p style="margin-top: 25px; font-size: 13px; color: #94a3b8;">
          Sent by LifeAdmin Document Organizer. You are receiving this because you registered this document.
        </p>
      </div>
    </div>
  `;

  const subject = `Reminder: "${docTitle}" ${urgencyText} (${formattedDate})`;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const mailFrom = process.env.MAIL_FROM;

  if (brevoApiKey && mailFrom) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'LifeAdmin', email: mailFrom },
          to: [{ email: userEmail, name: userName || 'LifeAdmin User' }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Brevo API responded with ${response.status}: ${errText}`);
      }

      const result = await response.json();
      console.log(`[Brevo Email] Sent successfully to ${userEmail} (MessageId: ${result.messageId})`);
      return { success: true, messageId: result.messageId };
    } catch (apiErr) {
      console.error(`[Brevo Email Error] Failed to send email to ${userEmail}:`, apiErr.message);
      throw apiErr;
    }
  } else {
    // In development or when credentials are not configured, log to the terminal
    console.log(`[Email Mock (Dev)] To: ${userEmail} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }
}

/**
 * Checks all documents and sends reminders for those expiring in 30, 7, or 1 days.
 * Ensures a document expiring tomorrow receives the 1-day reminder, and 30/7 are not marked as sent prematurely.
 */
async function checkAndSendReminders() {
  const documents = await Document.find({}).populate('userId');

  const results = {
    checked: documents.length,
    sent: 0,
    details: [],
  };

  for (const doc of documents) {
    if (!doc.userId || !doc.userId.email || !doc.expiryDate) continue;

    const daysUntilExpiry = doc.daysUntilExpiry;

    // If already expired (< 0) or uncalculated, skip
    if (daysUntilExpiry === null || daysUntilExpiry === undefined || daysUntilExpiry < 0) {
      continue;
    }

    let targetInterval = null;

    if (daysUntilExpiry <= 1) {
      // 1-day reminder tier (today or tomorrow)
      if (!doc.remindersSent.includes(1)) {
        targetInterval = 1;
      }
    } else if (daysUntilExpiry <= 7) {
      // 7-day reminder tier
      if (!doc.remindersSent.includes(7)) {
        targetInterval = 7;
      }
    } else if (daysUntilExpiry <= 30) {
      // 30-day reminder tier
      if (!doc.remindersSent.includes(30)) {
        targetInterval = 30;
      }
    }

    if (targetInterval !== null) {
      try {
        await sendExpiryEmail(
          doc.userId.email,
          doc.userId.name,
          doc.title,
          doc.category,
          doc.expiryDate,
          daysUntilExpiry
        );

        await Document.updateOne(
          { _id: doc._id },
          { $addToSet: { remindersSent: targetInterval } }
        );
        doc.remindersSent = [...new Set([...(doc.remindersSent || []), targetInterval])];

        results.sent += 1;
        results.details.push({
          documentId: doc._id,
          title: doc.title,
          recipient: doc.userId.email,
          interval: targetInterval,
          daysUntilExpiry,
        });
      } catch (err) {
        console.error(`[Reminder] Failed to send email for doc ${doc._id}:`, err.message);
      }
    }
  }

  return results;
}

/**
 * Starts the daily node-cron schedule (Runs every day at 11:00 PM / 23:00 IST).
 */
function initCronJob() {
  // Cron schedule: Run daily at 11:00 PM (23:00) IST
  cron.schedule(
    '0 23 * * *',
    async () => {
      console.log('[Cron] Running daily document expiry reminder check (11:00 PM IST)...');
      try {
        const summary = await checkAndSendReminders();
        console.log(`[Cron] Completed check. Checked: ${summary.checked}, Sent: ${summary.sent}`);
      } catch (err) {
        console.error('[Cron] Error running reminder check:', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('[Cron] Expiry reminder cron job scheduled (daily at 11:00 PM IST / 23:00 Asia/Kolkata).');
}

module.exports = {
  checkAndSendReminders,
  sendExpiryEmail,
  initCronJob,
};
