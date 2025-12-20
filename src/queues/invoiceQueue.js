const { Queue } = require("bullmq");
const connection = require("../config/redis");

const facturaQueue = new Queue("colaFacturacion", { connection });

// Función para añadir facturas a la cola con reintentos exponenciales
const agregarFacturaACola = async (factura) => {
  await facturaQueue.add("procesarFactura", factura, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000, // Primer reintento a los 5s, luego 10s, 20s...
    },
    removeOnComplete: true, // Limpiar Redis al terminar
  });
};

module.exports = { facturaQueue, agregarFacturaACola };
