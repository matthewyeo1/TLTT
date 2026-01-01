async function sendReply({ to, threadId, body }) {
  console.log('\n================ AUTO-REPLY PREVIEW ================');
  console.log(`To       : ${to}`);
  console.log(`Thread ID: ${threadId || '(none)'}`);
  console.log('--------------------------------------------------');
  console.log(body);
  console.log('==================================================\n');

  // Simulate Gmail API response
  return {
    id: `mock-reply-${Date.now()}`,
    threadId,
    labelIds: ['SENT'],
  };
}

module.exports = { sendReply };