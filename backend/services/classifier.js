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

  return 'pending';
}

module.exports = { classifyStatus };
