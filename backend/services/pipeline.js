const { classifyStatus } = require('./classifier');
const { groupJobEmail } = require('./grouper');

async function processJobEmail(userId, email) {
  const status = classifyStatus(email);

  const job = await groupJobEmail(userId, email);
  if (!job) return null;

  // Append email to DB
  job.emails.push({
    messageId: email.id,
    subject: email.subject,
    sender: email.sender,
    snippet: email.snippet,
    date: new Date(email.date),
    inferredStatus: status,
  });

  // Status escalation logic
  if (status === 'accepted') job.status = 'accepted';
  if (status === 'rejected' && job.status !== 'accepted') {
    job.status = 'rejected';
  }

  job.lastUpdatedFromEmailAt = new Date();

  await job.save();

  // Return a flat object for frontend consumption
  return {
    id: email.id,               // Gmail message ID
    subject: email.subject || '(No subject)',
    from: email.sender,
    date: email.date,
    status: job.status || 'pending',
  };
}

module.exports = { processJobEmail };
