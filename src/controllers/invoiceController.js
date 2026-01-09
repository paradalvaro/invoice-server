const invoiceService = require("../services/invoiceService");

const pdfService = require("../services/pdfService");

const { agregarFacturaACola } = require("../queues/invoiceQueue");

const utils = require("../utils/utils");

const getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy,
      order,
      search,
      searchField,
      status,
      dueDateRange,
    } = req.query;
    const result = await invoiceService.getAllInvoices(
      req.user.id,
      req.user.type,
      page,
      limit,
      sortBy,
      order,
      search,
      searchField,
      status,
      dueDateRange
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    if (req.body.status === "Draft") {
      const invoiceData = { ...req.body, userId: req.user.id };
      const invoice = await invoiceService.createInvoice(invoiceData);
      return res.status(201).json(invoice);
    }
    const previousHash = await invoiceService.getInvoicePreviousHash(
      req.body.serie,
      req.body.invoiceNumber
    );
    const hash = utils.makeInvoiceHash(req.body, previousHash);
    const invoiceData = { ...req.body, userId: req.user.id, hash };
    const invoice = await invoiceService.createInvoice(invoiceData);

    //await agregarFacturaACola({ invoice });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(
      req.params.id,
      req.user.id,
      req.user.type
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
      req.user.type,
      req.body
    );
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    await invoiceService.deleteInvoice(
      req.params.id,
      req.user.id,
      req.user.type
    );
    res.json({ message: "Invoice removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const generatePdf = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(
      req.params.id,
      req.user.id,
      req.user.type
    );

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=invoice-${invoice.serie}${invoice.invoiceNumber}.pdf`,
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

const sendInvoiceByEmail = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(
      req.params.id,
      req.user.id,
      req.user.type
    );
    const { emails } = req.body;
    let buffers = [];

    pdfService.buildPDF(invoice, buffers.push.bind(buffers), async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);
        await pdfService.sendPDFInvoiceByEmail(pdfBuffer, invoice, emails);
        res.json({ message: "Invoice sent by email" });
      } catch (emailErr) {
        console.error("Error sending email:", emailErr);
        res.status(500).json({ message: "Error sending invoice by email" });
      }
    });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getNextNumber = async (req, res) => {
  try {
    const { serie } = req.query;
    const nextNumber = await invoiceService.getNextInvoiceNumber(serie);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markAsPaid = async (req, res) => {
  try {
    const invoice = await invoiceService.markAsPaid(
      req.params.id,
      req.user.id,
      req.user.type
    );
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getModelo347 = async (req, res) => {
  try {
    const { year } = req.query; // Assuming year is passed as a query parameter
    const data = await invoiceService.getModelo347Data(req.user.id, year);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getModelo347,
  generatePdf,
  getNextInvoiceNumber: getNextNumber,
  sendInvoiceByEmail,
  markAsPaid,
};
