const JobApplication = require('../../models/JobApplication');
const { isNoReply, inferInterviewSubtypeHeuristic, classifyStatus } = require('./classifier');
const { extractCompany, extractRole, makeKey } = require('./grouper');
const { queueAutoReply } = require('../mailing/autoReplyQueue');
const EmailLog = require('../../models/EmailLog');

async function processJobEmail(userId, email, accessToken) {
  const status = classifyStatus(email);
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);
  const isRejected = status === 'rejected';
  const eligibleForAutoReply = isRejected && !isNoReply(email.sender);
  let inferredSubtype = 'unspecified';

  if (!company || !role) return null;

  const normalizedKey = makeKey(userId, company, role);

  const newEmail = {
    messageId: email.id,
    subject: email.subject,
    sender: email.sender,
    snippet: email.snippet,
    date: new Date(email.date),
    inferredStatus: status,
  };

  // Fetch existing job to preserve replied state if it exists
  const existingJob = await JobApplication.findOne({ normalizedKey });

  const autoReplyObject = {
    eligible: eligibleForAutoReply,
    replied: existingJob?.autoReply?.replied || false,
    repliedAt: existingJob?.autoReply?.repliedAt,
    replyMessageId: existingJob?.autoReply?.replyMessageId,
  };

  // Atomic upsert
  const job = await JobApplication.findOneAndUpdate(
    { normalizedKey },
    {
      $push: { emails: { $each: [newEmail] } },
      $set: {
        lastUpdatedFromEmailAt: new Date(),
        autoReply: autoReplyObject,
      },
      // Escalate status if higher priority
      $max: { status: status },
      $setOnInsert: {
        userId,
        company,
        role,
        normalizedKey,
        interviewSubtype: 'unspecified',
      },
    },
    { new: true, upsert: true }
  );

  // Update interview subtype if status is interview
  if (status === "interview" && job.interviewSubtype === "unspecified") {
    inferredSubtype = inferInterviewSubtypeHeuristic(email);
    console.log("Inferred subtype:", inferredSubtype, email.subject);

    if (inferredSubtype !== "unspecified") {
      job.interviewSubtype = inferredSubtype;
      await job.save();
    }
  }

  // Queue auto-reply if eligible and not replied yet
  if (eligibleForAutoReply && !job.autoReply.replied) {
    queueAutoReply(job._id);
  }

  // Create EmailLog entry
  if (status === 'interview' || status === 'accepted') {
    try {
      await EmailLog.create({
        userId,
        messageId: email.id,
        status,
        subject: email.subject,
        from: email.sender,
        date: new Date(email.date),
        company,
        role,
        interviewSubtype: status === 'interview' ? inferredSubtype : undefined,
      });
    } catch (err) {
      if (err.code !== 11000) {
        console.error('Error creating EmailLog:', err);
      } 
    }
  }

  

  return {
    id: email.id,
    subject: email.subject || '(No subject)',
    from: email.sender,
    date: email.date,
    status: job.status,
    company: job.company,
    role: job.role,
    autoReply: job.autoReply,
  };
}

module.exports = { processJobEmail };
