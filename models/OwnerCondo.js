const mongoose = require('mongoose');

const ownerCondoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    condoId: {
        type: String,
        ref: 'condo',
        required: true
    }
}, { versionKey: false, timestamps: true });

const ownerCondoModel = mongoose.model('ownerCondo', ownerCondoSchema);

module.exports = ownerCondoModel;
