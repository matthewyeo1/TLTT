const JobApplication = require('../models/JobApplication');
const { classifyStatus } = require('./classifier');
const { extractCompany, extractRole, makeKey } = require('./grouper');

async function processJobEmail(userId, email) {
  const status = classifyStatus(email);
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);

  if (!company || !role) return null;

  const normalizedKey = makeKey(userId, company, role);

  // Keep only the latest email
  const job = await JobApplication.findOneAndUpdate(
    { normalizedKey },
    {
      $set: {
        emails: [{
          messageId: email.id,
          subject: email.subject,
          sender: email.sender,
          snippet: email.snippet,
          date: new Date(email.date),
          inferredStatus: status,
        }],
        status: status,
        lastUpdatedFromEmailAt: new Date(),
      },
      $setOnInsert: {
        userId,
        company,
        role,
        normalizedKey,
      },
    },
    { new: true, upsert: true }
  );

  return {
    id: email.id,
    subject: email.subject || '(No subject)',
    from: email.sender,
    date: email.date,
    status: job.status,
    company: job.company,
    role: job.role,
  };
}

module.exports = { processJobEmail };
