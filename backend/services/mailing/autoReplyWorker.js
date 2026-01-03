const JobApplication = require('../../models/JobApplication');
const User = require('../../models/User');
const { sendReply } = require('./replySender');
const { generateReply } = require('./model');
const { sendPushNotification } = require('./notificationsHandler');

async function handleAutoReply(jobId) {
  const job = await JobApplication.findById(jobId);
  if (!job) return;

  if (!job.autoReply?.eligible) return;
  if (job.autoReply.replied) return;

  const user = await User.findById(job.userId);
  if (!user?.gmail?.accessToken) return;

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
    accessToken: user.gmail.accessToken,
    refreshToken: user.gmail.refreshToken,
    expiryDate: user.gmail.expiryDate,
    userId: user._id,
  });

  if (result?.id) {
    console.log(`[AutoReply] Sent reply for jobId: ${jobId}`);
    await sendPushNotification(job.userId, `Your auto-reply to ${job.company} was sent.`);
  }

  await JobApplication.updateOne(
    { _id: jobId },
    {
      $set: {
        'autoReply.replied': true,
        'autoReply.repliedAt': new Date(),
        'autoReply.replyMessageId': result.id,
        'autoReply.queued': false,
      },
    }
  );
}

module.exports = { handleAutoReply };
