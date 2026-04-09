const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function generateReply({ company, role }) {
  const prompt = `
    Write a polite, professional reply acknowledging a job rejection. My name is Matthew.

    Rules:
    - Max 80 words
    - No questions
    - No promises
    - Neutral corporate tone

    Company: ${company}
    Role: ${role}

    Return ONLY the email body text.
  `;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  return completion.choices[0].message.content.trim();
}

async function classifyEmail({ subject, snippet, sender }) {
  const prompt = `
    Classify this job application email into exactly one category:
    - rejected (they said no)
    - interview (they want to schedule an interview)  
    - accepted (they made an offer)
    - pending (none of the above)
    
    Also extract company name (from sender or content) and role (from subject).
    
    Email subject: ${subject}
    Email snippet: ${snippet}
    Sender: ${sender}
    
    Return ONLY valid JSON. Do NOT wrap in markdown code blocks. Do NOT add any text outside the JSON.
    Do NOT include phrases like "Here's the JSON" or any explanations.
    Just return the raw JSON object.
    
    Example: {"status": "rejected", "company": "Google", "role": "Software Engineer"}
  `;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });

    let responseText = completion.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // NEW: Try to extract JSON from text that might have explanatory prefixes
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    // Parse JSON
    const result = JSON.parse(responseText);
    
    // Validate the response structure
    const validStatuses = ['pending', 'rejected', 'accepted', 'interview'];
    if (!result.status || !validStatuses.includes(result.status)) {
      throw new Error(`Invalid status: ${result.status}`);
    }
    
    return {
      status: result.status,
      company: result.company || null,
      role: result.role || null
    };
    
  } catch (err) {
    console.error('[LLM] Classification error:', err.message);
    console.error('[LLM] Raw response:', completion?.choices[0]?.message?.content);
    throw err;
  }
}

module.exports = { generateReply, classifyEmail };
