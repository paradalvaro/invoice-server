const { Worker } = require("bullmq");
const connection = require("../config/redis");
const utils = require("../utils/utils");
const convertirNumeroALetras = require("../services/soapService");

const worker = new Worker(
  "colaFacturacion",
  async (job) => {
    console.log(
      `Procesando envío de factura ${job.data.invoice.invoiceNumber}...`
    );
    const invoice = job.data.invoice;
    const invoiceData = `<soapenv:Envelope
xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
<soapenv:Header/>
<soapenv:Body>

<AltaRegistroFacturacionRequest>

<!-- ================== -->
<!-- CABECERA OBLIGATORIA -->
<!-- ================== -->
<Cabecera>
<IDVersion>1.0</IDVersion>
<Titular>
<NIF>XXXXXXXXX</NIF>
</Titular>
</Cabecera>

<!-- ================== -->
<!-- REGISTRO DE FACTURA -->
<!-- ================== -->
<RegistroFactura>

<Factura>

<!-- Tipo de factura normal -->
<TipoFactura>${invoice.type}</TipoFactura>

<!-- Identificación -->
<NumeroFactura>${invoice.serie + invoice.invoiceNumber}</NumeroFactura>
<FechaExpedicion>${invoice.date}</FechaExpedicion>

<!-- Datos del destinatario -->
<Destinatario>
<NombreRazon>${invoice.clientName}</NombreRazon>
<NIF>${invoice.clientNIF}</NIF>
</Destinatario>

<!-- Detalle de líneas -->
<DetalleFactura>
  ${invoice.services
    .map(
      (service) => `
  <LineaFactura>
    <Descripcion>${service.concept}</Descripcion>
    <Cantidad>${service.quantity}</Cantidad>
    <PrecioUnitario>${service.price}</PrecioUnitario>
    <ImporteTotalLinea>${
      Number(service.price) * Number(service.quantity)
    }</ImporteTotalLinea>
  </LineaFactura>`
    )
    .join("")}
</DetalleFactura>

<!-- Impuestos -->
<Impuestos>

<IVA>
<TipoImpositivo>21.00</TipoImpositivo>
<BaseImponible>${invoice.services.reduce(
      (acc, service) =>
        acc + Number(service.taxBase) * Number(service.quantity),
      0
    )}</BaseImponible>
<CuotaRepercutida>${invoice.services.reduce(
      (acc, service) => acc + Number(service.iva),
      0
    )}</CuotaRepercutida>
</IVA>

</Impuestos>

<!-- Totales -->
<ImporteTotal>${invoice.totalAmount}</ImporteTotal>

</Factura>

</RegistroFactura>

</AltaRegistroFacturacionRequest>

</soapenv:Body>
</soapenv:Envelope>`;

    // Aquí va la lógica real de Veri*Factu o Zoho
    // Si esta función lanza un error, BullMQ lo reintentará solo
    //await servicioVeriFactu.enviar(job.data.datos);
    //await convertirNumeroALetras(123);
    console.log(`Envío finalizado con éxito. ${invoiceData}`);
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
