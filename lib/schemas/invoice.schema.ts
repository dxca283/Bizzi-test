import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative("Unit price must be greater than or equal to 0"),
});

export const createInvoiceSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Invoice must contain at least one item"),
  taxRate: z
    .number()
    .nonnegative("Tax rate must be greater than or equal to 0")
    .default(10),
});

export const updateInvoiceSchema = z.object({
  customerName: z.string().min(1, "Customer name cannot be empty").optional(),
  customerEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Invoice must contain at least one item")
    .optional(),
  taxRate: z
    .number()
    .nonnegative("Tax rate must be greater than or equal to 0")
    .optional(),
});

export const replaceInvoiceSchema = z.object({
  reason: z.string().min(1, "Replacement reason is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Invoice must contain at least one item"),
  taxRate: z
    .number()
    .nonnegative("Tax rate must be greater than or equal to 0")
    .default(10),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1, "Invoice ID is required"),
});

export const listInvoicesQuerySchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "CANCELED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ReplaceInvoiceInput = z.infer<typeof replaceInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
