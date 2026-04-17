const EmailLog = require('../../models/EmailLog')

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

function isAssessmentInvitation(text) {
  return (
    text.includes('coding challenge') ||
    text.includes('assessment') ||
    text.includes('hackerrank') ||
    text.includes('kattis') ||
    text.includes('take at your convenience') ||
    text.includes('online assessment')
  );
}

function isTakeHomeCodingTask(text) {
  return (
    text.includes('coding problem') ||    
    text.includes('coding task') ||
    text.includes('take-home assignment') ||
    text.includes('take home coding') ||
    text.includes('coding exercise') ||
    text.includes('coding assignment')
  );
}

async function isEmailCancelled(userId, messageId) {
  const EmailLog = require('../../models/EmailLog');
  const cancelled = await EmailLog.findOne({
    userId,
    messageId,
    status: 'cancelled'   
  });
  return !!cancelled;
}

// Detect if this is a confirmation/reply email (not a new invitation)
function isConfirmationOrReply(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  
  // KEY PHRASES that indicate this is a CONFIRMATION (not an invitation)
  const confirmationPhrases = [
    'thank you for submitting your availability',
    'confirm that we have received',
    'this email is to confirm',
    'we have received your interview availability',
    'your interview availability has been received',
    'availability has been received',
    'thank you for providing your availability',
    'we have received your response',
    'confirmation of your interview',
    'your interview has been confirmed',
    'interview confirmation',
    'you have confirmed',
    'your slot has been booked',
    'booking confirmed'
  ];
  
  // PHRASES that indicate this is an INVITATION (actionable)
  const invitationPhrases = [
    'click the button below',
    'share your interview availability',
    'provide your availability',
    'schedule your interview',
    'book a time',
    'select a time slot',
    'choose your interview time',
    'provide as many options as possible',
    'please submit your availability'
  ];
  
  // Check if it contains confirmation phrases (and NOT invitation phrases)
  const hasConfirmationPhrase = confirmationPhrases.some(phrase => text.includes(phrase));
  const hasInvitationPhrase = invitationPhrases.some(phrase => text.includes(phrase));
  
  // If it has confirmation language and no invitation language, it's a confirmation
  if (hasConfirmationPhrase && !hasInvitationPhrase) {
    console.log(`[Filter] Confirmation email detected: ${email.subject?.substring(0, 50)}`);
    return true;
  }
  
  // Also check for quoted/replied text patterns
  const hasReplyPattern = (
    text.includes('>') ||
    text.includes('wrote:') ||
    text.includes('-----original message-----') ||
    text.includes('---------- Forwarded')
  );
  
  return hasReplyPattern;
}

// Detect if this is a reminder email (not actionable for scheduling)
function isReminderEmail(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  
  const reminderIndicators = [
    'reminder:',
    'interview reminder',
    'upcoming interview',
    'your interview is tomorrow',
    'your interview is today',
    'don\'t forget your interview',
    'interview coming up',
    '24 hours before your interview'
  ];
  
  return reminderIndicators.some(indicator => text.includes(indicator));
}

// Detect if this is a follow-up email (already scheduled, just confirmation)
function isFollowUpConfirmation(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  
  // Check if the email is from the same thread but contains confirmation language
  const followUpIndicators = [
    'following up',
    'as discussed',
    'per our conversation',
    'to confirm our meeting',
    'here is the calendar invite',
    'google calendar invitation',
    'has accepted your invitation',
    'event invitation'
  ];
  
  return followUpIndicators.some(indicator => text.includes(indicator));
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
    text.includes('time works for you') || 
    text.includes('interview') ||
    text.includes('call with') ||
    text.includes('video call') ||
    text.includes('phone screen') ||
    text.includes('book a time')
  ) {
    return 'schedule_interview';
  }

  return 'unspecified';
}

function classifyStatus(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();

  // First check if this is a confirmation/reply (should be filtered out)
  if (isConfirmationOrReply(email) || isReminderEmail(email) || isFollowUpConfirmation(email)) {
    return 'scheduled';  // New status to indicate already handled
  }

  if (isApplicationConfirmation(text)) {
    return 'pending';
  }

  if (isAssessmentInvitation(text)) {
    return 'online_assessment';
  }

  if (isTakeHomeCodingTask(text)) {
    return 'coding_task';
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

// Helper function to determine if an email should create an EmailLog
function shouldCreateEmailLog(email, status) {
  // Don't create EmailLog for confirmation/reply emails
  if (isConfirmationOrReply(email)) {
    console.log(`[Filter] Skipping confirmation/reply email: ${email.subject?.substring(0, 50)}`);
    return false;
  }
  
  // Don't create EmailLog for reminder emails
  if (isReminderEmail(email)) {
    console.log(`[Filter] Skipping reminder email: ${email.subject?.substring(0, 50)}`);
    return false;
  }
  
  // Don't create EmailLog for follow-up confirmations
  if (isFollowUpConfirmation(email)) {
    console.log(`[Filter] Skipping follow-up confirmation: ${email.subject?.substring(0, 50)}`);
    return false;
  }
  
  // Only create EmailLog for actionable statuses
  const actionableStatuses = ['interview', 'accepted', 'online_assessment', 'coding_task'];
  if (!actionableStatuses.includes(status)) {
    console.log(`[Filter] Skipping non-actionable status (${status}): ${email.subject?.substring(0, 50)}`);
    return false;
  }
  
  return true;
}

module.exports = { 
  isNoReply, 
  inferInterviewSubtypeHeuristic, 
  classifyStatus,
  isConfirmationOrReply,
  isAssessmentInvitation,
  isTakeHomeCodingTask,
  isReminderEmail,
  isFollowUpConfirmation,
  shouldCreateEmailLog,
  isEmailCancelled
};