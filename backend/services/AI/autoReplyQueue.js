const { handleAutoReply } = require('./autoReplyWorker');

function queueAutoReply(jobId) {
  console.log(`[Queue] Queuing auto-reply for jobId: ${jobId}`);
  setImmediate(() => {
    handleAutoReply(jobId).catch(console.error);
  });
}

module.exports = { queueAutoReply };
