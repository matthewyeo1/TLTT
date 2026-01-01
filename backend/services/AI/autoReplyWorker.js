const JobApplication = require('../../models/JobApplication');
const { sendReply } = require('./replySender');
const { generateReply } = require('./model');

async function handleAutoReply(jobId) {
  const job = await JobApplication.findById(jobId);
  if (!job) return;

  if (!job.autoReply?.eligible) return;
  if (job.autoReply.replied) return;

  const email = job.emails[0];
  if (!email) return;

  const replyText = await generateReply({
    company: job.company,
    role: job.role,
  });

  const result = await sendReply({
    to: email.sender,
    threadId: email.threadId, 
    body: replyText,
  });

  await JobApplication.updateOne(
    { _id: jobId },
    {
      $set: {
        'autoReply.replied': true,
        'autoReply.repliedAt': new Date(),
        'autoReply.replyMessageId': result.id,
      },
    }
  );
}

module.exports = { handleAutoReply };
