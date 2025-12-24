const JobApplication = require('../models/JobApplication');
const crypto = require('crypto');

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeKey(userId, company, role) {
  return crypto
    .createHash('sha1')
    .update(`${userId}:${company}:${role}`)
    .digest('hex');
}

function extractCompany(sender = '') {
  // "Name from Company <email>"
  const fromMatch = sender.match(/from\s+([^<]+)/i);
  if (fromMatch) return normalize(fromMatch[1]);

  // "<Company> <email>"
  const nameMatch = sender.match(/^([^<@]+)</);
  if (nameMatch) return normalize(nameMatch[1]);

  // domain-based fallback: e.g. recruiting.aumovio.com → aumovio
  const domainMatch = sender.match(/@(?:[a-z0-9-]+\.)*([a-z0-9-]+)\./i);
  if (domainMatch) return normalize(domainMatch[1]);

  return null;
}

function extractRole(subject = '') {
  const cleaned = subject
    .replace(/your application at/i, '')
    .replace(/\[.*?\]/g, '')
    .split(/–|-|@/)[1];

  return cleaned ? normalize(cleaned) : null;
}

async function groupJobEmail(userId, email) {
  // naive extraction (model replaces this later)
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);

  if (!company || !role) return null;

  const normalizedKey = makeKey(userId, company, role);

  let job = await JobApplication.findOne({ normalizedKey });

  if (!job) {
    job = await JobApplication.create({
      userId,
      company,
      role,
      normalizedKey,
      emails: [],
    });
  }

  return job;
}

module.exports = { groupJobEmail };
