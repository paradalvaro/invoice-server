const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/multerConfig");

const roleMiddleware = require("../middleware/roleMiddleware");

router.post("/register", upload.single("photo"), authController.register);
router.post("/login", authController.login);

router.get("/users", authMiddleware, authController.getUsers);
router.put(
  "/users/:id",
  authMiddleware,
  roleMiddleware,
  upload.single("photo"),
  authController.updateUser
);
router.delete(
  "/users/:id",
  authMiddleware,
  roleMiddleware,
  authController.deleteUser
);

module.exports = router;
