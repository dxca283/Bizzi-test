import { Router } from "express";
import { invoiceController } from "../controllers/invoice.controller.js";
import { validate } from "../lib/middlewares/validate.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  replaceInvoiceSchema,
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
} from "../lib/schemas/invoice.schema.js";

const router = Router();

// CRUD operations
router.post(
  "/",
  validate(createInvoiceSchema, "body"),
  invoiceController.create.bind(invoiceController)
);

router.get(
  "/",
  validate(listInvoicesQuerySchema, "query"),
  invoiceController.getAll.bind(invoiceController)
);

router.get(
  "/:id",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.getById.bind(invoiceController)
);

router.patch(
  "/:id",
  validate(invoiceIdParamSchema, "params"),
  validate(updateInvoiceSchema, "body"),
  invoiceController.update.bind(invoiceController)
);

router.delete(
  "/:id",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.delete.bind(invoiceController)
);

// Business actions
router.post(
  "/:id/issue",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.issue.bind(invoiceController)
);

router.post(
  "/:id/cancel",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.cancel.bind(invoiceController)
);

router.post(
  "/:id/replace",
  validate(invoiceIdParamSchema, "params"),
  validate(replaceInvoiceSchema, "body"),
  invoiceController.replace.bind(invoiceController)
);

router.get(
  "/:id/pdf",
  validate(invoiceIdParamSchema, "params"),
  invoiceController.getPdf.bind(invoiceController)
);

export default router;
