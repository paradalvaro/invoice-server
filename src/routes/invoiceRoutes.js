const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get("/", invoiceController.getInvoices);
router.get("/next-number", invoiceController.getNextNumber);
router.post("/", invoiceController.createInvoice);
router.get("/:id", invoiceController.getInvoice);
router.get("/:id/pdf", invoiceController.generatePdf);
router.post("/:id/sendEmail", invoiceController.sendInvoiceByEmail);
router.put("/:id", roleMiddleware, invoiceController.updateInvoice);
router.put("/:id/paid", roleMiddleware, invoiceController.markAsPaid);
router.delete("/:id", roleMiddleware, invoiceController.deleteInvoice);

module.exports = router;
