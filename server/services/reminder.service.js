const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Document = require('../models/Document');
const User = require('../models/User');

let transporter = null;

/**
 * Initializes the Nodemailer transporter.
 * Falls back to an Ethereal test account if credentials are not configured.
 */
async function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (emailUser && emailPass && !emailUser.includes('example.com')) {
    // Real SMTP / Gmail setup
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  } else {
    // Development fallback using Ethereal test account
    console.log('[Email] No production email credentials set. Creating Ethereal test transporter...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Ethereal test account initialized: ${testAccount.user}`);
    } catch (etherealErr) {
      console.warn('[Email] Could not create Ethereal account, falling back to mock JSON transport:', etherealErr.message);
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}

/**
 * Sends a stylized reminder email to the document owner.
 */
async function sendExpiryEmail(userEmail, userName, docTitle, category, expiryDate, daysLeft) {
  const mailer = await getTransporter();

  // Format calendar date without timezone shift
  const exp = new Date(expiryDate);
  const day = String(exp.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${day} ${months[exp.getUTCMonth()]} ${exp.getUTCFullYear()}`;

  const urgencyText = daysLeft <= 0 ? 'Expires Today!' : daysLeft === 1 ? 'Expires Tomorrow!' : `Expires in ${daysLeft} days`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="background-color: #2563eb; padding: 15px; border-radius: 6px 6px 0 0; color: white;">
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

  const info = await mailer.sendMail({
    from: `"LifeAdmin" <${process.env.EMAIL_USER || 'no-reply@lifeadmin.local'}>`,
    to: userEmail,
    subject: `Reminder: "${docTitle}" ${urgencyText} (${formattedDate})`,
    html,
  });

  // Log preview URL if using Ethereal
  if (nodemailer.getTestMessageUrl(info)) {
    console.log(`[Email] View preview at: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return info;
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
 * Starts the daily node-cron schedule (Runs every day at midnight 00:00).
 */
function initCronJob() {
  // Cron schedule: Run at midnight every day
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily document expiry reminder check...');
    try {
      const summary = await checkAndSendReminders();
      console.log(`[Cron] Completed check. Checked: ${summary.checked}, Sent: ${summary.sent}`);
    } catch (err) {
      console.error('[Cron] Error running reminder check:', err);
    }
  });

  console.log('[Cron] Expiry reminder cron job scheduled (daily at 00:00).');
}

module.exports = {
  checkAndSendReminders,
  sendExpiryEmail,
  initCronJob,
};
