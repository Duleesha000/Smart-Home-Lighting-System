const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  room: { type: String, required: true },
  action: { type: String, enum: ['ON', 'OFF'], required: true },
  reason: { type: String, default: '' }
}, { versionKey: false });

module.exports = mongoose.model('ActionLog', ActionLogSchema);
