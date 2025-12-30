const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function classifyEmail({ subject, body, from }) {
  const prompt = `
You are an email classification engine.

Rules:
- Return ONLY valid JSON.
- Do NOT include explanations.
- If the email is sent via LinkedIn jobs, the group name should be the company instead of Linkedin.
- Group names must be short and generic (e.g. Google, HRT, IBM, Continental, Paypal, etc.).
- If the company name is not clearly present, infer it conservatively from the subject.
- Role must be the job title (e.g. Software Engineer Intern).
- Do NOT invent company or role names.
- If unsure, return an empty string for group or role.
- Categories must be one of:
  Accepted, Rejected, Interview, Pending

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 500)}

Return JSON in this exact format:
{
  "group": "",
  "role": "",
  "category": "",
  "confidence": 0.0
}
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: 0,
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return null;
  }
}

module.exports = { classifyEmail };
