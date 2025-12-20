const { Worker } = require("bullmq");
const connection = require("../config/redis");
const convertirNumeroALetras = require("../services/soapService");

const worker = new Worker(
  "colaFacturacion",
  async (job) => {
    console.log(`Procesando envío de factura ${job.data.facturaId}...`);

    // Aquí va la lógica real de Veri*Factu o Zoho
    // Si esta función lanza un error, BullMQ lo reintentará solo
    //await servicioVeriFactu.enviar(job.data.datos);
    await convertirNumeroALetras(123);
    console.log("Envío finalizado con éxito.");
  },
  { connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  console.error(
    `La tarea ${job.id} falló tras todos los reintentos: ${err.message}`
  );
  // Aquí podrías marcar la factura en tu DB como "ERROR_ENVIO"
});

module.exports = worker;
