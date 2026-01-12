const express = require("express");
const router = express.Router();
const albaranController = require("../controllers/albaranController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", albaranController.getAlbaranes);
router.get("/next-number", albaranController.getNextNumber);
router.post("/", albaranController.createAlbaran);
router.get("/:id/pdf", albaranController.generatePdf);
router.get("/:id", albaranController.getAlbaran);
router.put("/:id", albaranController.updateAlbaran);
router.delete("/:id", albaranController.deleteAlbaran);

module.exports = router;
