const express = require("express");
const router = express.Router();
const billController = require("../controllers/billController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", billController.getBills);
router.post("/", billController.createBill);
router.get("/next-number", billController.getNextBillNumber);
router.get("/:id", billController.getBill);
router.put("/:id", billController.updateBill);
router.delete("/:id", billController.deleteBill);

module.exports = router;
