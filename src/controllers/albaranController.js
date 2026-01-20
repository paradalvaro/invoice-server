const albaranService = require("../services/albaranService");
const pdfService = require("../services/pdfService");
const Settings = require("../models/Settings");

const getAlbaranes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy,
      order,
      search,
      searchField,
      status,
      client,
      pendingInvoice,
      invoiceId,
    } = req.query;
    const result = await albaranService.getAllAlbaranes(
      req.user.id,
      req.user.type,
      page,
      limit,
      sortBy,
      order,
      search,
      searchField,
      status,
      client,
      pendingInvoice,
      invoiceId,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAlbaran = async (req, res) => {
  try {
    const albaranData = { ...req.body, userId: req.user.id };
    const albaran = await albaranService.createAlbaran(albaranData);
    res.status(201).json(albaran);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAlbaran = async (req, res) => {
  try {
    const albaran = await albaranService.getAlbaranById(
      req.params.id,
      req.user.id,
      req.user.type,
    );
    res.json(albaran);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateAlbaran = async (req, res) => {
  try {
    const albaran = await albaranService.updateAlbaran(
      req.params.id,
      req.user.id,
      req.user.type,
      req.body,
    );
    res.json(albaran);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteAlbaran = async (req, res) => {
  try {
    await albaranService.deleteAlbaran(
      req.params.id,
      req.user.id,
      req.user.type,
    );
    res.json({ message: "Albaran removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getNextNumber = async (req, res) => {
  try {
    const { serie } = req.query;
    const nextNumber = await albaranService.getNextAlbaranNumber(serie);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generatePdf = async (req, res) => {
  try {
    const albaran = await albaranService.getAlbaranById(
      req.params.id,
      req.user.id,
      req.user.type,
    );

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=albaran-${
        albaran.serie || ""
      }${albaran.AlbaranNumber || ""}.pdf`,
    });

    const settings = await Settings.findOne();
    const timezone = settings ? settings.timezone : "Europe/Madrid";

    pdfService.buildAlbaranPDF(
      albaran,
      (chunk) => stream.write(chunk),
      () => stream.end(),
      timezone,
    );
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  getAlbaranes,
  createAlbaran,
  getAlbaran,
  updateAlbaran,
  deleteAlbaran,
  getNextNumber,
  generatePdf,
};
