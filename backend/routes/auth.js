const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const authMiddleware = require('../middleware/auth');
const loginLimiter = require('../middleware/loginLimiter');

// Protected route 
router.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'You are authenticated!', user: req.user });
});

// Register user
router.post('/register', async (req, res) => {
  let { name, email, password } = req.body;
  console.log('Register attempt with email:', email, 'and password type:', typeof password);

  // Trim whitespaces
  name = name.trim();
  email = email.trim();
  password = password.trim();

  console.log('Trimmed inputs - Name:', name, 'Email:', email, 'Password length:', password.length);

  // Check 1. Required fields
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // Check 2. Name validation
  const nameRegex = /^[A-Za-z0-9 ]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({ error: "Name can only contain letters, numbers, and spaces" });
  }

  // Check 3. Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check 4a. Password length validation
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  // Check 4b. Password must include at least one special character
  const specialCharRegex = /[!@#$%^&*()\[\]{};:'"\\|,<.>\/?`~\-+=_]/;
  if (!specialCharRegex.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one special character' });
  }

  try {

    // Check 5. Unique email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ error: 'Email already exists' });

    // Check 6. Unique username
    const existingName = await User.findOne({ name });
    if (existingName) return res.status(400).json({ error: 'Name already exists' });

    const user = new User({ name, email, passwordHash: password });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({ userId: user._id, token });
  } catch (err) {
    console.error('Full Register error:', err);  
    res.status(500).json({ error: 'Server error', details: err});
  }
});

// User login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt with email:', email, 'and password type:', typeof password);
  
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ userId: user._id, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
