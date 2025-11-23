const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    validDate: {
        type: Date,
        required: true
    }
});

const blockedUserModel = mongoose.model('blocked user', blockedUserSchema);
module.exports = blockedUserModel;