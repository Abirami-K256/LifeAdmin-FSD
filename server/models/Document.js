const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'Other',
    },
    documentNumber: {
      type: String,
      trim: true,
      default: '',
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    gridFsFileId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    encryptedFilePath: {
      type: String,
      default: '',
    },
    originalFileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    ocrText: {
      type: String,
      default: '',
    },
    ocrConfidence: {
      type: String,
      enum: ['high', 'medium', 'low', 'manual'],
      default: 'medium',
    },
    remindersSent: {
      type: [Number], // e.g. [30, 7, 1] for 30-day, 7-day, 1-day reminders sent
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual property to calculate days until expiry without timezone shifting
documentSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.expiryDate) return null;
  const exp = new Date(this.expiryDate);
  if (isNaN(exp.getTime())) return null;

  const now = new Date();
  // Compare pure calendar day boundaries in UTC
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((expiryUtc - todayUtc) / msPerDay);
});

// Virtual property for expiry status: 'safe', 'expiring_soon', 'expired'
documentSchema.virtual('status').get(function () {
  const days = this.daysUntilExpiry;
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'safe';
});

module.exports = mongoose.model('Document', documentSchema);
