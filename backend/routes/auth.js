const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const authMiddleware = require('../middleware/auth');

// Protected route 
router.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'You are authenticated!', user: req.user });
});

// Register user
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  console.log('Register attempt with email:', email, 'and password type:', typeof password);
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const user = new User({ name, email, passwordHash: password });

    await user.save();

    const token = generateToken(user);
    res.status(201).json({ userId: user._id, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User login
router.post('/login', async (req, res) => {
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
