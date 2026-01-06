const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");

const email = process.env.EMAIL;
const password = process.env.PASSWORD;

const buildPDF = async (invoice, dataCallback, endCallback) => {
  const doc = new PDFDocument();

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  doc.fontSize(25).text("Invoice", { align: "center" });
  doc.moveDown();

  doc
    .fontSize(12)
    .text(`Invoice Number: ${invoice.invoiceNumber} (${invoice.type || "F1"})`);
  doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`);
  if (invoice.type !== "F2") {
    doc.text(`Client: ${invoice.clientName}`);
    doc.text(`Client NIF: ${invoice.clientNIF}`);
  }
  doc.moveDown();

  // Services section
  doc.fontSize(14).text("Services:", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  if (invoice.services && invoice.services.length > 0) {
    invoice.services.forEach((service, index) => {
      const lineTotal = service.taxBase * (service.quantity || 1) + service.iva;
      doc.text(
        `${index + 1}. ${service.concept} - Qty: ${
          service.quantity || 1
        } | Base: €${service.taxBase.toFixed(2)} | IVA: €${service.iva.toFixed(
          2
        )} | Total: €${lineTotal.toFixed(2)}`
      );
    });
  } else {
    doc.text("No services defined.");
  }
  doc.moveDown();

  doc.fontSize(12).text(`Total Amount: €${invoice.totalAmount.toFixed(2)}`, {
    align: "right",
  });

  doc.moveDown();
  try {
    const qrData = JSON.stringify({
      nifEmisor: "AXXXXXXXX",
      numeroFactura: invoice.serie + invoice.invoiceNumber,
      fechaExpedicion: invoice.date,
      importeTotal: invoice.totalAmount,
      tipoFactura: invoice.type || "F1",
      hash: invoice.hash,
    });
    // Generate QR Code as a Buffer
    const qrBuffer = await QRCode.toBuffer(qrData);

    // Add QR Code to PDF
    doc.moveDown();
    doc.text("Scan for details:", { align: "center" });
    doc.image(qrBuffer, { fit: [100, 100], align: "center" });
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  doc.end();
};

const sendPDFInvoiceByEmail = async (pdfBuffer, invoice, emails) => {
  const transporter = nodemailer.createTransport({
    //host: process.env.SMTP_HOST,
    //port: process.env.SMTP_PORT,
    //secure: true,
    service: "gmail",
    auth: {
      user: email, //process.env.EMAIL_USER,
      pass: password, //process.env.EMAIL_PASS
    },
  });

  const mailOptions = {
    from: email,
    to: emails || email,
    subject: `Factura ${invoice.serie}${invoice.invoiceNumber} generada`,
    text: "Adjunto encontrará su factura en formato PDF.",
    //html: '<b>PDF Invoice</b><p>PDF Invoice</p>',
    attachments: [
      {
        filename: `Factura_${invoice.serie}${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer, // Pasamos el buffer directamente de la memoria
      },
    ],
  };

  // 3. Enviar el correo
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado con éxito: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    throw error;
  }
};
module.exports = { buildPDF, sendPDFInvoiceByEmail };
