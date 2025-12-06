const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {

  if (!JWT_SECRET) {
    console.error('authMiddleware: JWT_SECRET is not set in environment');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  
  let token;

  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    } else {
      token = req.headers.authorization;
    }
  }

  // Check x-access-token header
  if (!token && req.headers['x-access-token']) token = req.headers['x-access-token'];

  // Check cookies, query params, or body
  if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
  if (!token && req.query && req.query.token) token = req.query.token;
  if (!token && req.body && req.body.token) token = req.body.token;

  // DEBUG: log the raw token and its type to help locate type mismatches
  console.log('authMiddleware: raw token ->', token, 'typeof ->', typeof token);

  if (!token) return res.status(401).json({ error: 'No token provided' });

  // If the incoming token is not a string try to coerce it safely
  if (typeof token !== 'string') {
    try {
      token = String(token);
      console.log('authMiddleware: coerced token ->', token, 'typeof ->', typeof token);
    } catch (coerceErr) {
      console.error('authMiddleware: unable to coerce token to string', coerceErr);
      return res.status(401).json({ error: 'Invalid token format' });
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('authMiddleware: decoded token ->', decoded);
    req.user = decoded;

    // forward token so downstream handlers / proxies see it too
    req.headers.authorization = `Bearer ${token}`;
    res.locals.token = token;

    next();
  } catch (err) {
    console.error('authMiddleware: token verify error ->', err && err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
