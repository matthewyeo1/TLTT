const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const express = require("express");
const router = express.Router();

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  res.json(user);
});

// Save Expo push token
router.post('/me/token', authMiddleware, async (req, res) => {
  try {
    const { expoToken } = req.body;

    if (!expoToken) {
      return res.status(400).json({ error: "Expo push token is required" });
    }

    const user = await User.findById(req.user.id);

    // Avoid duplicates
    if (!user.expoToken.includes(expoToken)) {
        user.expoToken.push(expoToken);
        await user.save();
    }

    res.json({ success: true, expoToken });
  } catch (err) {
    console.error("Failed to save Expo token:", err);
    res.status(500).json({ error: "Failed to save token" });
  }
});

module.exports = router;