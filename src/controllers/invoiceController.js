const invoiceService = require("../services/invoiceService");

const pdfService = require("../services/pdfService");

const getInvoices = async (req, res) => {
  try {
    const invoices = await invoiceService.getAllInvoices(req.user.id);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    const invoiceData = { ...req.body, userId: req.user.id };
    const invoice = await invoiceService.createInvoice(invoiceData);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(
      req.params.id,
      req.user.id
    );
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.updateInvoice(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    await invoiceService.deleteInvoice(req.params.id, req.user.id);
    res.json({ message: "Invoice removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const generatePdf = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(
      req.params.id,
      req.user.id
    );

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=invoice-${invoice.invoiceNumber}.pdf`,
    });

    pdfService.buildPDF(
      invoice,
      (chunk) => stream.write(chunk),
      () => stream.end()
    );
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  getInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  generatePdf,
};
