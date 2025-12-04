const mongoose = require('mongoose');
// Define schema for login history
const loginAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    loginAt: {
        type: Date,
        default: Date.now
    },
    success: {
        type: Boolean,
        required: true
    }
});

const loginAttemptModel = mongoose.model('login attempt', loginAttemptSchema, 'auth_login attempts');
module.exports = loginAttemptModel;