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
  const normalizedRole = role ? normalize(role) : 'unknown';
  const normalizedCompany = company ? normalize(company) : 'unknown';
  return crypto
    .createHash('sha1')
    .update(`${userId}:${normalizedCompany}:${normalizedRole}`)
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
    .split(/–|-|@/)[0];

  return cleaned ? normalize(cleaned) : null;
}

async function groupJobEmail(userId, email) {
  const company = extractCompany(email.sender);
  const role = extractRole(email.subject);
  if (!company || !role) return null;

  const normalizedKey = makeKey(userId, company, role);

  // Atomic upsert: find or create
  const job = await JobApplication.findOneAndUpdate(
    { normalizedKey },
    {
      $setOnInsert: {
        userId,
        company,
        role,
        emails: [],
        status: 'pending',
        lastUpdatedFromEmailAt: new Date(),
      },
    },
    { new: true, upsert: true }
  );

  return job;
}

module.exports = { groupJobEmail, makeKey, extractCompany, extractRole };
