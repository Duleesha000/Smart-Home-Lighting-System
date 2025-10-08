const mongoose = require('mongoose');

const ReadingSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  room: { type: String, required: true },
  motion: { type: Boolean, required: true },
  lux: { type: Number, required: true }
}, { versionKey: false });

module.exports = mongoose.model('Reading', ReadingSchema);
