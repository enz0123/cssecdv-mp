const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    username: {
        type: String,
        default: null
    },
    route: {
        type: String,
        default: null
    },
    method: {
        type: String,
        default: null
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

// Use a clean collection name; adjust if you prefer to keep old one
const loginAttemptModel = mongoose.model(
    'login attempt',
    loginAttemptSchema,
    'auth_login attempts'
);

module.exports = loginAttemptModel;