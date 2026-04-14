const JobApplication = require('../../models/JobApplication');
const EmailLog = require('../../models/EmailLog');
const { 
  isNoReply, 
  inferInterviewSubtypeHeuristic, 
  classifyStatus,
  shouldCreateEmailLog,
  isEmailCancelled
} = require('./classifier');
const { extractCompany, extractRole, makeKey } = require('./grouper');
const { queueAutoReply } = require('../mailing/autoReplyQueue');
const { classifyEmail } = require('../model/model')
const { ClassificationCache } = require('../cache/databaseCache');
const { parseInterviewRound } = require('../../utils/interviewRoundParser');

const STATUS_PRIORITY = {
  pending: 0,
  interview: 1,
  rejected: 2,
  accepted: 3,
};

// Instantiate in-memory cache with 60 minute TTL
const classificationCache = new ClassificationCache(60);

// Fallback rule-based classifier should model fail
function getRuleBasedClassification(email) {
  const status = classifyStatus(email);
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);
  
  console.log(`[Rules] Classified as ${status} for: ${email.subject?.substring(0, 50)}`);
  
  return {
    status,
    company,
    role,
    source: 'rules'
  };
}

// Cache lookup for existing email classification
async function getExistingClassification(email) {
  try {
    const job = await JobApplication.findOne({
      'emails.messageId': email.id
    });
    
    if (job) {
      const existingEmail = job.emails.find(e => e.messageId === email.id);
      if (existingEmail) {
        console.log(`[DB Cache] Found existing classification for: ${email.subject?.substring(0, 50)}`);
        return {
          status: existingEmail.inferredStatus,
          company: job.company,
          role: job.role,
          source: 'database'
        };
      }
    }
    
    return null;
  } catch (err) {
    console.error('[DB Cache] Error checking existing email:', err.message);
    return null;
  }
}

// Save tokens if tell-tale signs are detected
function shouldSkipLLM(email) {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  
  if (text.includes('thank you for applying') ||
      text.includes('application received') ||
      text.includes('we have received your application') ||
      text.includes('confirmation of your application') ||
      text.includes('your application has been submitted')) {
    console.log(`[Skip LLM] Application confirmation: ${email.subject?.substring(0, 50)}`);
    return { skip: true, reason: 'confirmation' };
  }
  
  if (text.includes('newsletter') ||
      text.includes('unsubscribe') ||
      text.includes('marketing') ||
      text.includes('promotion')) {
    console.log(`[Skip LLM] Marketing/newsletter: ${email.subject?.substring(0, 50)}`);
    return { skip: true, reason: 'marketing' };
  }
  
  if (text.includes('purchase') ||
      text.includes('order confirmed') ||
      text.includes('shipping') ||
      text.includes('receipt')) {
    console.log(`[Skip LLM] Non-job email: ${email.subject?.substring(0, 50)}`);
    return { skip: true, reason: 'non-job' };
  }
  
  const noReplyDomains = ['noreply', 'no-reply', 'donotreply', 'notifications', 'alerts'];
  const senderLower = email.sender.toLowerCase();
  if (noReplyDomains.some(domain => senderLower.includes(domain))) {
    if (!text.includes('unfortunately') && !text.includes('regret') && 
        !text.includes('interview') && !text.includes('offer')) {
      console.log(`[Skip LLM] No-reply sender without decision keywords: ${email.subject?.substring(0, 50)}`);
      return { skip: true, reason: 'noreply' };
    }
  }
  
  return { skip: false };
}

// Email classification using LLM
async function getEmailClassification(email) {
  const cached = classificationCache.get(email);
  if (cached) {
    return cached;
  }
  
  const dbCached = await getExistingClassification(email);
  if (dbCached) {
    classificationCache.set(email, dbCached);
    return dbCached;
  }
  
  const skipCheck = shouldSkipLLM(email);
  if (skipCheck.skip) {
    const ruleResult = getRuleBasedClassification(email);
    classificationCache.set(email, ruleResult);
    return ruleResult;
  }
  
  try {
    console.log(`[LLM] Classifying new email: ${email.subject?.substring(0, 50)}`);
    
    const llmResult = await classifyEmail({
      subject: email.subject,
      snippet: email.snippet,
      sender: email.sender
    });
    
    const result = {
      status: llmResult.status,
      company: llmResult.company,
      role: llmResult.role,
      source: 'llm'
    };
    
    classificationCache.set(email, result);
    
    console.log(`[LLM] Classified as ${result.status} for: ${email.subject?.substring(0, 50)}`);
    return result;
    
  } catch (err) {
    console.log(`[LLM] Error: ${err.message}. Falling back to rules for: ${email.subject?.substring(0, 50)}`);
    
    const ruleResult = getRuleBasedClassification(email);
    classificationCache.set(email, ruleResult);
    return ruleResult;
  }
}

// Replaces current status with the new one if it has higher priority
function escalateStatus(current, incoming) {
  return STATUS_PRIORITY[incoming] > STATUS_PRIORITY[current] ? incoming : current;
}

// Process job email via pipeline
async function processJobEmail(userId, email) {
  const classification = await getEmailClassification(email);
  const status = classification.status;
  const company = classification.company;
  const role = classification.role;
  
  console.log(`[Process] Using ${classification.source.toUpperCase()} - Status: ${status}, Company: ${company}, Role: ${role}`);

  const isRejected = status === 'rejected';
  const eligibleForAutoReply = isRejected && !isNoReply(email.sender);
  const emailDate = new Date(email.date);

  if (!company || !role) return null;

  const normalizedKey = makeKey(userId, company, role);

  const newEmail = {
    messageId: email.id,
    subject: email.subject,
    sender: email.sender,
    snippet: email.snippet,
    date: new Date(email.date),
    inferredStatus: status,
  };

  // Fetch existing job to prevent duplicates
  let job = await JobApplication.findOne({ normalizedKey });

  const autoReplyObject = {
    eligible: eligibleForAutoReply,
    replied: job?.autoReply?.replied || false,
    repliedAt: job?.autoReply?.repliedAt,
    replyMessageId: job?.autoReply?.replyMessageId,
  };

  // Determine if newEmail already exists
  let emailsToPush = [newEmail];
  if (job) {
    const existingIds = new Set(job.emails.map(e => e.messageId));
    emailsToPush = emailsToPush.filter(e => !existingIds.has(e.messageId));
  }

  // Determine if the email is newer than last update
  const isNewerThanLastUpdate =
    !job?.lastUpdatedFromEmailAt ||
    emailDate > job.lastUpdatedFromEmailAt;

  // Determine next status
  let nextStatus = job?.status ?? status;
  
  if (isNewerThanLastUpdate) {
    nextStatus = escalateStatus(nextStatus, status);
  }

  // Atomic update 
  if (emailsToPush.length > 0 || !job) {
    job = await JobApplication.findOneAndUpdate(
      { normalizedKey },
      {
        $setOnInsert: {
          userId,
          company,
          role,
          normalizedKey,
          interviewSubtype: status === 'interview' ? 'unspecified' : undefined,
        },
        $push: { emails: { $each: emailsToPush } },
        $set: {
          lastUpdatedFromEmailAt: new Date(),
          autoReply: autoReplyObject,
        },
        $max: { status: nextStatus },
      },
      { new: true, upsert: true }
    );
  } else {
    // Update status and autoReply even if no new emails
    job.status = escalateStatus(job.status, status);
    job.autoReply = autoReplyObject;
    job.lastUpdatedFromEmailAt = new Date();
    await job.save();
  }

  // Update interview subtype if necessary
  if (status === 'interview' && job.interviewSubtype === 'unspecified') {
    const inferredSubtype = inferInterviewSubtypeHeuristic(email);
    if (inferredSubtype !== 'unspecified') {
      job.interviewSubtype = inferredSubtype;
      await job.save();
    }
  }

  // Queue auto-reply if eligible and not replied yet
  if (eligibleForAutoReply && !job.autoReply.replied) {
    queueAutoReply(job._id);
  }

  // Create EmailLog for interview or accepted emails
  if (status === 'interview' || status === 'accepted') {

    // Filters 
    if (!shouldCreateEmailLog(email, status) || await isEmailCancelled(userId, email.id)) {
      // console.log(`[Pipeline] Skipping EmailLog creation for confirmation/reply: ${email.subject?.substring(0, 50)}`);
      // Skip EmailLog creation entirely, but still return the job result
      return {
        id: email.id,
        subject: email.subject || '(No subject)',
        from: email.sender,
        date: email.date,
        status: job.status,
        company: job.company,
        role: job.role,
        autoReply: job.autoReply,
        interviewSubtype: job.interviewSubtype,
        classifiedBy: classification.source,
      };
    }

    // Filter 2: Check if email was previously cancelled

    try {
      const emailDate = new Date(email.date);
      
      // Parse interview round information
      const { roundNumber, interviewRound } = parseInterviewRound(
        email.subject, 
        email.snippet, 
        email.sender
      );
      
      // STEP 1: Deactivate any newer active interviews for same company/role
      // This handles the case where a newer email was processed first
      await EmailLog.updateMany(
        {
          userId,
          company,
          role: role,
          status: 'interview',
          isActive: true,
          date: { $gt: emailDate } // Newer email exists
        },
        {
          $set: {
            isActive: false,
            supersededAt: new Date(),
            supersededBy: null // Will be updated if we have the new ID
          }
        }
      );
      
      // STEP 2: Check if there's already an active interview for this company/role
      const existingActive = await EmailLog.findOne({
        userId,
        company,
        role: role,
        status: 'interview',
        isActive: true
      });
      
      // STEP 3: Determine if this email should be active
      let shouldBeActive = true;
      let supersededById = null;
      
      if (existingActive) {
        if (existingActive.date > emailDate) {
          // Existing is newer - this email should NOT be active
          shouldBeActive = false;
          supersededById = existingActive._id;
          console.log(`[EmailLog] Keeping existing (${existingActive.date}), marking this (${emailDate}) as inactive`);
        } else if (existingActive.date < emailDate) {
          // This email is newer - deactivate the existing one
          await EmailLog.updateOne(
            { _id: existingActive._id },
            {
              $set: {
                isActive: false,
                supersededAt: new Date(),
                supersededBy: null // Will update after creating new
              }
            }
          );
          console.log(`[EmailLog] Newer email (${emailDate}), deactivated existing (${existingActive.date})`);
        } else {
          // Same date - check if same email
          if (existingActive.messageId === email.id) {
            shouldBeActive = false;
            console.log(`[EmailLog] Duplicate email, skipping`);
          }
        }
      }
      
      // STEP 4: Create or update the EmailLog
      if (shouldBeActive) {
        const newEmailLog = await EmailLog.findOneAndUpdate(
          {
            userId,
            messageId: email.id
          },
          {
            $set: {
              userId,
              messageId: email.id,
              status,
              subject: email.subject,
              from: email.sender,
              date: emailDate,
              company,
              role,
              interviewSubtype: status === 'interview' ? job.interviewSubtype : undefined,
              interviewRound,
              roundNumber,
              isActive: true,
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              supersededBy: null
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          {
            upsert: true,
            new: true
          }
        );
        
        // Update supersededBy reference for the old one if needed
        if (supersededById) {
          await EmailLog.updateOne(
            { _id: supersededById },
            { $set: { supersededBy: newEmailLog._id } }
          );
        }
      } else {
        // Create as inactive (for historical record)
        await EmailLog.findOneAndUpdate(
          {
            userId,
            messageId: email.id
          },
          {
            $set: {
              userId,
              messageId: email.id,
              status,
              subject: email.subject,
              from: email.sender,
              date: emailDate,
              company,
              role,
              interviewSubtype: status === 'interview' ? job.interviewSubtype : undefined,
              interviewRound,
              roundNumber,
              isActive: false,
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              supersededBy: supersededById
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          {
            upsert: true
          }
        );
      }
      
    } catch (err) {
      if (err.code !== 11000) {
        console.error('Error creating EmailLog:', err);
      }
    }
  }

  return {
    id: email.id,
    subject: email.subject || '(No subject)',
    from: email.sender,
    date: email.date,
    status: job.status,
    company: job.company,
    role: job.role,
    autoReply: job.autoReply,
    interviewSubtype: job.interviewSubtype,
    classifiedBy: classification.source,
  };
}

module.exports = { processJobEmail };
