const JobApplication = require('../../models/JobApplication');
const User = require('../../models/User');
const { sendReply } = require('./replySender');
const { generateReply } = require('../model/model');
const { sendPushNotification } = require('./notificationsHandler');
const crypto = require('crypto');

async function handleAutoReply(jobId) {
  // Generate unique lock ID for processing attempt
  const lockId = `${jobId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  // Step 1: Try to acquire the lock with atomic operation
  const job = await JobApplication.findOneAndUpdate(
    {
      _id: jobId,
      'autoReply.eligible': true,
      'autoReply.replied': { $ne: true },
      'autoReply.processingLock': null  // Lock is available
    },
    {
      $set: {
        'autoReply.processingLock': lockId,  // Acquire the lock
        'autoReply.queued': false,
        'autoReply.processingStartedAt': new Date()
      }
    },
    { 
      new: true,  // Return the updated document
      runValidators: false  // Skip validation for this atomic operation
    }
  );
  
  // Guardrails
  if (!job) return;
  if (!job.autoReply?.eligible) return;
  if (job.autoReply.replied) return;

  const user = await User.findById(job.userId);
  if (!user?.gmail?.accessToken) return;

  const email = job.emails[0];
  if (!email) return;
  
  console.log(`[AutoReply] Lock acquired for job ${jobId} with lockId: ${lockId}`);
  
  try {
    // Step 2: Get user data
    const user = await User.findById(job.userId);
    if (!user?.gmail?.accessToken) {
      console.log(`[AutoReply] User ${job.userId} has no Gmail access`);
      await releaseLock(jobId, lockId);
      return;
    }
    
    // Step 3: Get the latest email
    const email = job.emails[0];
    if (!email) {
      console.log(`[AutoReply] No email found for job ${jobId}`);
      await releaseLock(jobId, lockId);
      return;
    }
    
    // Step 4: Generate reply
    console.log(`[AutoReply] Generating reply for ${job.company} - ${job.role}`);
    const replyText = await generateReply({
      company: job.company,
      role: job.role,
    });
    
    // Step 5: Send the reply
    const result = await sendReply({
      to: email.sender,
      threadId: email.threadId,
      body: replyText,
      accessToken: user.gmail.accessToken,
      refreshToken: user.gmail.refreshToken,
      expiryDate: user.gmail.expiryDate,
      userId: user._id,
    });
    
    // Step 6: Mark as replied (release lock and set replied flag)
    if (result?.id) {
      console.log(`[AutoReply] Sent reply for jobId: ${jobId}, messageId: ${result.id}`);
      
      await JobApplication.updateOne(
        { 
          _id: jobId,
          'autoReply.processingLock': lockId  // Only update if we still hold the lock
        },
        {
          $set: {
            'autoReply.replied': true,
            'autoReply.repliedAt': new Date(),
            'autoReply.replyMessageId': result.id,
            'autoReply.processingLock': null,  // Release the lock
          }
        }
      );
      
      // Send notification
      await sendPushNotification(
        job.userId, 
        `Auto-reply to ${job.company} was sent successfully!`
      );
    } else {
      // Failed to send, release lock without marking as replied
      console.log(`[AutoReply] Failed to send reply for job ${jobId}`);
      await releaseLock(jobId, lockId);
    }
    
  } catch (error) {
    console.error(`[AutoReply] Error processing job ${jobId}:`, error);
    
    // Release the lock on error so it can be retried
    await releaseLock(jobId, lockId);
    
    // Optionally notify admin or user
    await sendPushNotification(
      job.userId,
      `Auto-reply to ${job.company} failed. Please check your Gmail connection.`
    );
  }
}

// Helper function to release the lock
async function releaseLock(jobId, lockId) {
  const result = await JobApplication.updateOne(
    {
      _id: jobId,
      'autoReply.processingLock': lockId  // Only release if we still hold the lock
    },
    {
      $set: {
        'autoReply.processingLock': null,
        'autoReply.queued': false
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`[AutoReply] Lock released for job ${jobId}`);
  } else {
    console.log(`[AutoReply] Lock already released or held by another process for job ${jobId}`);
  }
}

module.exports = { handleAutoReply };