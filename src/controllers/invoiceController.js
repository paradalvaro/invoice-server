const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const invoiceService = require("../services/invoiceService");

const pdfService = require("../services/pdfService");

const { agregarFacturaACola } = require("../queues/invoiceQueue");

const utils = require("../utils/utils");
const Settings = require("../models/Settings");

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
      dueDateRange,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    let invoice;
    if (req.body.status === "Draft") {
      const invoiceData = { ...req.body, userId: req.user.id };
      invoice = await invoiceService.createInvoice(invoiceData);
    } else {
      const previousHash = await invoiceService.getInvoicePreviousHash(
        req.body.serie,
        req.body.invoiceNumber,
      );
      const hash = utils.makeInvoiceHash(req.body, previousHash);
      const invoiceData = { ...req.body, userId: req.user.id, hash };
      invoice = await invoiceService.createInvoice(invoiceData);
    }

    if (req.body.albaranIds && req.body.albaranIds.length > 0 && invoice) {
      await invoiceService.linkAlbaranesToInvoice(
        invoice._id,
        req.body.albaranIds,
      );
    }

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
      req.user.type,
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
      req.body,
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
      req.user.type,
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
      req.user.type,
    );

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=invoice-${invoice.serie}${invoice.invoiceNumber}.pdf`,
    });

    const settings = await Settings.findOne();
    const timezone = settings ? settings.timezone : "Europe/Madrid";

    pdfService.buildPDF(
      invoice,
      (chunk) => stream.write(chunk),
      () => stream.end(),
      timezone,
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
      req.user.type,
    );
    const { emails } = req.body;
    let buffers = [];

    const settings = await Settings.findOne();
    const timezone = settings ? settings.timezone : "Europe/Madrid";

    pdfService.buildPDF(invoice, buffers.push.bind(buffers), async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);
        await pdfService.sendPDFInvoiceByEmail(pdfBuffer, invoice, emails);

        // Log email event in history
        await Invoice.findByIdAndUpdate(invoice._id, {
          $push: {
            history: {
              type: "EMAIL_SENT",
              date: new Date(),
              description: `Factura enviada por correo a: ${emails}`,
              details: { recipients: emails },
            },
          },
        });

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
      req.user.type,
    );
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getModelo347 = async (req, res) => {
  try {
    const { year } = req.query; // Assuming year is passed as a query parameter
    const data = await invoiceService.getModelo347Data(
      req.user.id,
      req.user.type,
      year,
    );
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
  generateModelo347Pdf,
  getNextInvoiceNumber: getNextNumber,
  sendInvoiceByEmail,
  markAsPaid,
};

async function generateModelo347Pdf(req, res) {
  try {
    const {
      year,
      declarerInfo,
      selectedClientIds,
      summaryBoxes,
      rentalClientIds,
    } = req.body;

    // Fetch all candidates again to ensure data integrity
    const allCandidates = await invoiceService.getModelo347Data(
      req.user.id,
      req.user.type,
      year,
    );

    // Filter only selected clients and mark rentals
    const clients = allCandidates
      .filter((c) => selectedClientIds.includes(c._id.toString()))
      .map((c) => ({
        ...c,
        isRental: rentalClientIds
          ? rentalClientIds.includes(c._id.toString())
          : false,
      }));

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=Modelo347_${year}.pdf`,
    });

    const settings = await Settings.findOne();
    const timezone = settings ? settings.timezone : "Europe/Madrid";

    pdfService.buildModelo347PDF(
      { year, declarer: declarerInfo, clients, summaryBoxes },
      (chunk) => stream.write(chunk),
      () => stream.end(),
      timezone,
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}
