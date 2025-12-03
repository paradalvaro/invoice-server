const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", invoiceController.getInvoices);
router.post("/", invoiceController.createInvoice);
router.get("/:id", invoiceController.getInvoice);
router.get("/:id/pdf", invoiceController.generatePdf);
router.put("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
