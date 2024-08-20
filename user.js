const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    chatId: { type: String, required: true },
    joinDate: { type: Date, default: Date.now },
    kickDate: { type: Date, required: true }
});

const User = mongoose.model('Kick-User', userSchema);

const groupSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    kickAfter: { type: Number, default: 24 * 60 * 60 * 1000 },
    customMessage: { type: String, default: '' },
    customMessageEnabled: { type: Boolean, default: false }
});


const Group = mongoose.model('Group', groupSchema);

module.exports = { User, Group };