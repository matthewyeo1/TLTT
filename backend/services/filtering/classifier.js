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

function isApplicationConfirmation(text) {
  return (
    text.includes('thank you for applying') ||
    text.includes('application received') ||
    text.includes('we have received your application') ||
    text.includes('your application has been submitted') ||
    text.includes('confirmation of your application')
  );
}

function inferInterviewSubtypeHeuristic(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();

  if (
    text.includes('coding challenge') ||
    text.includes('assessment') ||
    text.includes('hackerrank') ||
    text.includes('kattis') ||
    text.includes('take at your convenience')
  ) {
    return 'online_assessment';
  }

  if (
    text.includes('availability') ||
    text.includes('schedule') ||
    text.includes('calendar') ||
    text.includes('time works for you')
  ) {
    return 'schedule_interview';
  }

  return 'unspecified';
}

function classifyStatus(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();

  if (isApplicationConfirmation(text)) {
    return 'pending';
  }

  if (
    text.includes('unfortunately') ||
    text.includes('regret to inform') ||
    text.includes('decided to move forward with other candidates') ||
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

module.exports = { isNoReply, inferInterviewSubtypeHeuristic, classifyStatus };
