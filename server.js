// ===== Imports =====
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const Reading = require('./models/Reading');
const ActionLog = require('./models/ActionLog');

// ===== Config =====
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MONGODB_URI = process.env.MONGODB_URI;

// Define all known rooms
const rooms = ['livingroom', 'bedroom', 'kitchen', 'livingarea'];

// ===== MongoDB =====
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ===== MQTT =====
const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
  console.log('✅ Connected to MQTT:', MQTT_URL);
  
  // Subscribe to all room sensor and light topics
  client.subscribe(['home/+/motion', 'home/+/lux', 'home/+/light/cmd', 'home/+/light/state'], err => {
    if (err) console.error('❌ MQTT subscribe error:', err.message);
    else console.log(`📡 Subscribed to topics for rooms: ${rooms.join(', ')}`);
  });
});

client.on('message', async (topic, payload) => {
  try {
    const msg = payload.toString();
    const parts = topic.split('/');
    const room = parts[1];
    const leaf = parts[2];
    const sub = parts[3];
    if (!room) return;

    // Make sure room exists
    if (!rooms.includes(room)) {
      console.warn(`⚠️ Ignored message from unknown room: ${room}`);
      return;
    }

    if (leaf === 'motion') {
      // Expect "0" or "1"
      const motion = msg === '1';
      const lastLux = await Reading.findOne({ room }).sort({ timestamp: -1 }).lean();
      const lux = lastLux ? lastLux.lux : 0;
      await Reading.create({ room, motion, lux });
      console.log(`📥 Reading: room=${room}, motion=${motion}, lux=${lux}`);

    } else if (leaf === 'lux') {
      const lux = Number(msg);
      const lastMotion = await Reading.findOne({ room }).sort({ timestamp: -1 }).lean();
      const motion = lastMotion ? lastMotion.motion : false;
      await Reading.create({ room, motion, lux });
      console.log(`📥 Reading: room=${room}, motion=${motion}, lux=${lux}`);

    } else if (leaf === 'light' && (sub === 'cmd' || sub === 'state')) {
      const action = (msg.toUpperCase() === 'ON') ? 'ON' : 'OFF';
      await ActionLog.create({ room, action, reason: sub.toUpperCase() });
      console.log(`💡 Light ${sub}: room=${room}, action=${action}`);
    }
  } catch (e) {
    console.error('❌ MQTT message handler error:', e.message);
  }
});

// ===== Simple API =====
app.get('/health', (_req, res) => res.send('OK'));

app.get('/stats', async (_req, res) => {
  try {
    const totalReadings = await Reading.countDocuments();
    const totalActions = await ActionLog.countDocuments();

    const offCount = await ActionLog.countDocuments({ action: 'OFF' });
    const energySavingPercent = totalActions > 0 ? Math.round((offCount / totalActions) * 100) : 0;

    const recent = await ActionLog.find().sort({ timestamp: -1 }).limit(10).lean();

    res.json({ totalReadings, totalActions, energySavingPercent, recent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Manual Light Control =====
app.post('/api/light/:room', (req, res) => {
  const { room } = req.params;
  const { action } = req.body;

  if (!rooms.includes(room.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid room name' });
  }

  if (!['ON', 'OFF'].includes((action || '').toUpperCase())) {
    return res.status(400).json({ error: 'Action must be ON or OFF' });
  }

  client.publish(`home/${room}/light/cmd`, action.toUpperCase());
  res.json({ room, action: action.toUpperCase(), published: true });
});

// ===== Start Server =====
app.listen(PORT, () => console.log(`🌍 Backend running on http://localhost:${PORT}`));
