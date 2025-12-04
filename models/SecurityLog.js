const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
    eventType: {
        type: String,
        enum: ['VALIDATION_FAILURE', 'ACCESS_CONTROL_FAILURE', 'AUTH_LOCKOUT'],
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    username: {
        type: String
    },
    route: {
        type: String
    },
    method: {
        type: String
    },
    message: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const securityLogModel = mongoose.model('security log', securityLogSchema, 'auth_security logs');
module.exports = securityLogModel;