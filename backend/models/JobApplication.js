const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },

    company: {
      type: String,
      index: true,
      required: true,
    },

    role: {
      type: String,
      required: true,
    },

    normalizedKey: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'rejected', 'accepted'],
      default: 'pending',
    },

    lastUpdatedFromEmailAt: Date,

    emails: [
      {
        messageId: String,
        subject: String,
        sender: String,
        snippet: String,
        date: Date,
        inferredStatus: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobApplication', JobApplicationSchema);
