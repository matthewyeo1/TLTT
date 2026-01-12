const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  messageId: { type: String, required: true },
  status: { type: String, enum: ["interview", "accepted"], required: true },
  subject: String,
  from: String,
  date: Date,
  company: String,
  role: String,
  createdAt: { type: Date, default: Date.now }
});

EmailLogSchema.index({ userId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model("EmailLog", EmailLogSchema);
