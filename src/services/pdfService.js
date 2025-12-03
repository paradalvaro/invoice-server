const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const buildPDF = async (invoice, dataCallback, endCallback) => {
  const doc = new PDFDocument();

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  doc.fontSize(25).text("Invoice", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`);
  doc.text(`Client: ${invoice.clientName}`);
  doc.moveDown();

  doc.text(`Total Amount: $${invoice.totalAmount}`, { align: "right" });

  doc.moveDown();
  try {
    const qrData = JSON.stringify({
      id: invoice._id,
      number: invoice.invoiceNumber,
      client: invoice.clientName,
      total: invoice.totalAmount,
      date: invoice.date,
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

module.exports = { buildPDF };
