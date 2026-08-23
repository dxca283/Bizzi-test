import express from "express";
import invoiceRoutes from "../routes/invoice.routes.js";
import { errorHandler } from "../lib/middlewares/errorHandler.js";

const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

// Invoice API routes
app.use("/api/invoices", invoiceRoutes);

// Global error handler middleware
app.use(errorHandler);

export default app;
