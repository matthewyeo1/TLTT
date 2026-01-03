const { handleAutoReply } = require('./autoReplyWorker');
const JobApplication = require('../../models/JobApplication');

async function queueAutoReply(jobId) {
  const job = await JobApplication.findById(jobId);
  if (!job) return;

  // Only queue if eligible and not already replied or queued
  if (!job.autoReply?.eligible || job.autoReply.replied || job.autoReply.queued) {
    console.log(`[Queue] Skipping jobId ${jobId}, already replied or queued`);
    return;
  }

  // Mark as queued immediately to prevent race conditions
  job.autoReply.queued = true;
  await job.save();

  console.log(`[Queue] Queuing auto-reply for jobId: ${jobId}`);
  setImmediate(async () => {
    try {
      await handleAutoReply(jobId);
    } catch (err) {
      console.error(err);
    }
  });
}

module.exports = { queueAutoReply };
