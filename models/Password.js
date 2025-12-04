const mongoose = require('mongoose');
// Define schema for password history
const passwordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    password: {
        type: String,
        required: true,
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
});

// Create the PasswordHistory model
const passwordModel = mongoose.model('password', passwordSchema, 'auth_passwords');

module.exports = passwordModel;