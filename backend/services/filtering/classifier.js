function isNoReply(sender) {
    if (!sender) return false;

    const s = sender.toLowerCase();
    return (
        s.includes('no-reply') ||
        s.includes('noreply') ||
        s.includes('do-not-reply') ||
        s.includes('donotreply') || 
        s.includes('myworkday')
    );
}

function classifyStatus(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();

  if (
    text.includes('unfortunately') ||
    text.includes('regret to inform') ||
    text.includes('we decided to move forward with other candidates') ||
    text.includes('not to move forward') ||
    text.includes('after careful consideration')
  ) {
    return 'rejected';
  }

  if (
    text.includes('offer') ||
    text.includes('pleased to inform') ||
    text.includes('congratulations')
  ) {
    return 'accepted';
  }

  if (
    text.includes('interview') ||
    text.includes('schedule') ||
    text.includes('invite you to') ||
    text.includes('call with') ||
    text.includes('video call') ||
    text.includes('phone screen')
  ) {
    return 'interview';
  }

  return 'pending';
}

module.exports = { isNoReply, classifyStatus };
