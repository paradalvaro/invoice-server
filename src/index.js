const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { facturaQueue } = require("./queues/invoiceQueue");
const authRoutes = require("./routes/authRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
require("@bull-board/ui/package.json");

require("./workers/invoiceWorker");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(facturaQueue)],
  serverAdapter: serverAdapter,
});

dotenv.config();

const app = express();

app.use("/admin/queues", serverAdapter.getRouter());
// Middleware
app.use(
  cors({
    origin: process.env.CORS_URL,
  })
);
app.use(express.json());
app.use("/api/uploads", express.static("uploads"));

// Database Connection
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/clients", require("./routes/clientRoutes"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
