const IORedis = require("ioredis");

const connectionRedis = new IORedis({
  host: "redis-10554.c280.us-central1-2.gce.cloud.redislabs.com",
  port: 10554,
  password: "WOEJu7kq9DNZVYx8eEDv4ZWMj1b6FziH",
  // IMPORTANTE: BullMQ necesita esto para no saturar Redis con intentos fallidos
  maxRetriesPerRequest: null,
});

connectionRedis.on("error", (err) => {
  console.error("Error de conexión a Redis:", err.message);
});

module.exports = connectionRedis;
