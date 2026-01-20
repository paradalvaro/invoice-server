const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get("/", invoiceController.getInvoices);
router.get("/modelo347", invoiceController.getModelo347);
router.post("/modelo347/pdf", invoiceController.generateModelo347Pdf);
router.get("/next-number", invoiceController.getNextInvoiceNumber);
router.post("/", invoiceController.createInvoice);
router.get("/:id", invoiceController.getInvoice);
router.get("/:id/pdf", invoiceController.generatePdf);
router.post("/:id/sendEmail", invoiceController.sendInvoiceByEmail);
router.put("/:id", invoiceController.updateInvoice);
router.put("/:id/paid", invoiceController.markAsPaid);
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
