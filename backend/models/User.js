const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
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

UserSchema.methods.comparePassword = function(password) {
    return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
