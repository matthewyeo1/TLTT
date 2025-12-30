function cleanEmailBody(raw) {
  if (!raw) return "";

  // decode HTML entities
  let decoded = raw.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

  // remove all HTML tags
  decoded = decoded.replace(/<\/?[^>]+(>|$)/g, "");

  // collapse multiple newlines/spaces
  decoded = decoded.replace(/\n\s*\n/g, "\n").trim();

  return decoded;
}

module.exports = { cleanEmailBody };