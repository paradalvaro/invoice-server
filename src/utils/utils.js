const crypto = require("crypto");

const makeJsonHash = (invoice, previousHash) => {
  const total = invoice.services.reduce(
    (acc, service) =>
      acc + parseFloat(service.taxBase) * parseFloat(service.quantity),
    0
  );
  const invoiceData = `IDEmisorFactura=XXXXXXXXA&NumSerieFactura=${
    invoice.serie + invoice.invoiceNumber
  }&FechaExpedicionFactura=${invoice.date}&TipoFactura=${
    invoice.type
  }&CuotaTotal=${total}&ImporteTotal=${
    invoice.totalAmount
  }&Huella=${previousHash}&FechaHoraHusoGenRegistro=${invoice.date}`;

  return invoiceData;
};

const makeHashSha256 = (invoiceJsonData) => {
  const hash = crypto.createHash("sha256");
  hash.update(invoiceJsonData);
  return hash.digest("hex").toUpperCase();
};

const makeInvoiceHash = (invoice, previousHash) => {
  const invoiceJsonData = makeJsonHash(invoice, previousHash);
  const hash = makeHashSha256(invoiceJsonData);
  return hash;
};

module.exports = { makeInvoiceHash };
