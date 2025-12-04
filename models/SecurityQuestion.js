const mongoose = require('mongoose');

const securityQuestionSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }, 
    securityQuestion1: Number,
    securityQuestion2: Number,
    securityAnswer1: String,
    securityAnswer2: String
})

const securityQuestionModel = mongoose.model('security question', securityQuestionSchema, 'auth_security questions');
module.exports = securityQuestionModel;