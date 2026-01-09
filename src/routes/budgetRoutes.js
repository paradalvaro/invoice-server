const express = require("express");
const router = express.Router();
const budgetController = require("../controllers/budgetController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get("/", budgetController.getBudgets);
router.get("/next-number", budgetController.getNextNumber);
router.post("/", budgetController.createBudget);
router.get("/:id", budgetController.getBudget);
router.put("/:id", roleMiddleware, budgetController.updateBudget);
router.delete("/:id", roleMiddleware, budgetController.deleteBudget);

module.exports = router;
