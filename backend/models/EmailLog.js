const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  messageId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    num: ["interview", "accepted", "scheduled"],
    required: true 
  },
  actionable: { 
    type: Boolean, 
    default: false
  },
  scheduling: {
      status: {
          type: String,
          enum: ['pending', 'scheduled'],
          default: 'pending',
      },
      scheduledAt: Date,
      timezone: String,
  },
  interviewSubtype: String,
  subject: String,
  from: String,
  date: Date,
  company: String,
  role: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  interviewRound: {
    type: String,
    enum: ['first', 'technical', 'hiring_manager', 'recruiter', 'final', 'unknown'],
    default: 'unknown'
  },
  roundNumber: {
    type: Number,
    default: null  // 1, 2, 3, etc.
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    index: { expires: 0 } // MongoDB TTL index for auto-deletion
  },
  isActive: {
    type: Boolean,
    default: true
  },
  calendarEventId: {
    type: String,
    default: null
  },
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailLog',
    default: null
  },
  supersededAt: {
    type: Date,
    default: null
  },
  scheduledSlot: {
    start: Date,
    end: Date,
    timezone: String
  },
  scheduledEnd: {
    type: Date,
    default: null
  }
});

EmailLogSchema.index( { userId: 1, company: 1, role: 1, roundNumber: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model("EmailLog", EmailLogSchema);
