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

module.exports = { generateReply };
