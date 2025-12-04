const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    name: String,
    configs: {
        internshipStart: Date,
        internshipEnd: Date,
        expectedPay: Number,
        workPref: String,
        university: String,
        major: String
    }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('passwordHash')) return next();

    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);

    next();
});

userSchema.methods.comparePassword = function(password) {
    return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
