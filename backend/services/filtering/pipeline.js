const JobApplication = require('../../models/JobApplication');
const EmailLog = require('../../models/EmailLog');
const { isNoReply, inferInterviewSubtypeHeuristic, classifyStatus } = require('./classifier');
const { extractCompany, extractRole, makeKey } = require('./grouper');
const { queueAutoReply } = require('../mailing/autoReplyQueue');

const STATUS_PRIORITY = {
  pending: 0,
  interview: 1,
  rejected: 2,
  accepted: 3,
};

// Replaces current status with the new one if it has higher priority
function escalateStatus(current, incoming) {
  return STATUS_PRIORITY[incoming] > STATUS_PRIORITY[current] ? incoming : current;
}

async function processJobEmail(userId, email) {
  const status = classifyStatus(email);
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);
  const isRejected = status === 'rejected';
  const eligibleForAutoReply = isRejected && !isNoReply(email.sender);
  const emailDate = new Date(email.date);

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

  // Fetch existing job to prevent duplicates
  let job = await JobApplication.findOne({ normalizedKey });

  const autoReplyObject = {
    eligible: eligibleForAutoReply,
    replied: job?.autoReply?.replied || false,
    repliedAt: job?.autoReply?.repliedAt,
    replyMessageId: job?.autoReply?.replyMessageId,
  };

  // Determine if newEmail already exists
  let emailsToPush = [newEmail];
  if (job) {
    const existingIds = new Set(job.emails.map(e => e.messageId));
    emailsToPush = emailsToPush.filter(e => !existingIds.has(e.messageId));
  }

  // Determine if the email is newer than last update
  const isNewerThanLastUpdate =
    !job?.lastUpdatedFromEmailAt ||
    emailDate > job.lastUpdatedFromEmailAt;

  // Determine next status
  let nextStatus = job?.status ?? status;
  
  if (isNewerThanLastUpdate) {
    nextStatus = escalateStatus(nextStatus, status);
  }

  // Atomic update 
  if (emailsToPush.length > 0 || !job) {
    job = await JobApplication.findOneAndUpdate(
      { normalizedKey },
      {
        $setOnInsert: {
          userId,
          company,
          role,
          normalizedKey,
          interviewSubtype: status === 'interview' ? 'unspecified' : undefined,
        },
        $push: { emails: { $each: emailsToPush } },
        $set: {
          lastUpdatedFromEmailAt: new Date(),
          autoReply: autoReplyObject,
        },
        $max: { status: nextStatus },
      },
      { new: true, upsert: true }
    );
  } else {
    // Update status and autoReply even if no new emails
    job.status = escalateStatus(job.status, status);
    job.autoReply = autoReplyObject;
    job.lastUpdatedFromEmailAt = new Date();
    await job.save();
  }

  // Update interview subtype if necessary
  if (status === 'interview' && job.interviewSubtype === 'unspecified') {
    const inferredSubtype = inferInterviewSubtypeHeuristic(email);
    if (inferredSubtype !== 'unspecified') {
      job.interviewSubtype = inferredSubtype;
      await job.save();
    }
  }

  // Queue auto-reply if eligible and not replied yet
  if (eligibleForAutoReply && !job.autoReply.replied) {
    queueAutoReply(job._id);
  }

  // Create EmailLog for interview or accepted emails
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
        interviewSubtype: status === 'interview' ? job.interviewSubtype : undefined,
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
    interviewSubtype: job.interviewSubtype,
  };
}

module.exports = { processJobEmail };
