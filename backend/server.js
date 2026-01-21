require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const authRoutes = require('./routes/auth');
const googleRoutes = require('./routes/google');
const emailRoutes = require('./routes/email');
const userRoutes = require('./routes/user');
const scheduleRoutes = require('./routes/schedule');
const devRoutes = require('./routes/dev');

app.use('/', googleRoutes);
app.use('/auth', authRoutes);
app.use('/auth/google', googleRoutes);
app.use('/email', emailRoutes);
app.use('/user', userRoutes);
app.use('/calendar', googleRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/dev', devRoutes);

const PORT = process.env.PORT;

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Test route
app.get('/', (req, res) => {
    res.send('TLTT Backend is running now!');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



