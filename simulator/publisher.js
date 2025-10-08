// ===== MQTT Simulator =====
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const client = mqtt.connect(MQTT_URL);

const rooms = ['livingroom', 'bedroom', 'kitchen', 'livingarea'];
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

client.on('connect', () => {
  console.log(`✅ Simulator connected to ${MQTT_URL}`);
  console.log(`📡 Publishing random sensor data for rooms: ${rooms.join(', ')}`);

  setInterval(() => {
    const time = new Date().toLocaleTimeString();
    rooms.forEach(room => {
      // Random motion (25% chance to detect motion)
      const motion = Math.random() < 0.25 ? 1 : 0;

      // Random lux based on motion (brighter if motion detected)
      const lux = motion ? randInt(300, 600) : randInt(20, 250);

      client.publish(`home/${room}/motion`, String(motion));
      client.publish(`home/${room}/lux`, String(lux));

      console.log(
        `${time} | 🏠 ${room.padEnd(11)} → motion=${motion ? 'YES' : 'NO'} | lux=${lux}`
      );
    });
  }, 2000); // every 2 seconds (less spammy)
});

client.on('error', err => {
  console.error('❌ MQTT connection error:', err.message);
});
