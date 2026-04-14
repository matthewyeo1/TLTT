const BATCH_SIZE = 15;
const RETRY_ATTEMPTS = 3;
const BASE_DELAY = 1000;

async function fetchMessageWithRetry(gmail, messageId, attempt = 0) {
  try {
    return await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });
  } catch (err) {
    if (err.code === 429 && attempt < RETRY_ATTEMPTS) {
      const delay = BASE_DELAY * Math.pow(2, attempt);
      console.log(`Rate limited for ${messageId}, retry ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchMessageWithRetry(gmail, messageId, attempt + 1);
    }
    throw err;
  }
}

async function fetchMessagesInBatches(gmail, messageIds, batchSize = BATCH_SIZE) {
  const results = [];
  
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, Math.min(i + batchSize, messageIds.length));
    console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messageIds.length / batchSize)} (${batch.length} messages)`);
    
    const batchPromises = batch.map(msgId => 
      fetchMessageWithRetry(gmail, msgId)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limits
    if (i + batchSize < messageIds.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

module.exports = { fetchMessagesInBatches };