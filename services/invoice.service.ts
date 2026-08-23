import { prisma } from "../lib/prisma.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  AppError,
} from "../lib/errors.js";
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ReplaceInvoiceInput,
  ListInvoicesQuery,
} from "../lib/schemas/invoice.schema.js";
import { pdfService } from "./pdf.service.js";


export class InvoiceService {

  private calculateTotals(
    items: { quantity: number; unitPrice: number }[],
    taxRate: number
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      0
    );
    const tax = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total,
    };
  }


  private async generateInvoiceNumber(tx = prisma): Promise<string> {
    const lastInvoice = await tx.invoice.findFirst({
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (lastInvoice?.invoiceNumber) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `INV-${String(nextNumber).padStart(6, "0")}`;
  }


  async createDraft(input: CreateInvoiceInput) {
    const taxRate = input.taxRate ?? 10;
    const { subtotal, tax, total } = this.calculateTotals(input.items, taxRate);
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        status: "DRAFT",
        subtotal,
        tax,
        total,
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return invoice;
  }

 
  async getAll(query: ListInvoicesQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          replacedInvoice: {
            select: { id: true, invoiceNumber: true, status: true },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  
  async getById(id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        items: true,
        replacedInvoice: {
          select: { id: true, invoiceNumber: true, status: true, issuedAt: true },
        },
        replacementInvoices: {
          select: { id: true, invoiceNumber: true, status: true, createdAt: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${id}' not found`);
    }

    return invoice;
  }


  async updateDraft(id: string, input: UpdateInvoiceInput) {
    const existing = await this.getById(id);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only DRAFT invoices can be updated");
    }

    // Determine items and taxRate for recalculation
    const items = input.items ?? existing.items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    }));

    // Derive effective taxRate from existing subtotal and tax if not explicitly provided
    let effectiveTaxRate = input.taxRate;
    if (effectiveTaxRate === undefined) {
      const existingSubtotal = Number(existing.subtotal);
      effectiveTaxRate =
        existingSubtotal > 0
          ? (Number(existing.tax) / existingSubtotal) * 100
          : 10;
    }

    const { subtotal, tax, total } = this.calculateTotals(items, effectiveTaxRate);

    // If items are being updated, delete old items and recreate
    const updated = await prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: existing.id },
        });
      }

      return tx.invoice.update({
        where: { id: existing.id },
        data: {
          customerName: input.customerName ?? existing.customerName,
          customerEmail:
            input.customerEmail !== undefined
              ? input.customerEmail
              : existing.customerEmail,
          subtotal,
          tax,
          total,
          ...(input.items && {
            items: {
              create: input.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
              })),
            },
          }),
        },
        include: {
          items: true,
        },
      });
    });

    return updated;
  }

  
  async deleteInvoice(id: string) {
    const existing = await this.getById(id);

    if (existing.status !== "DRAFT") {
      throw new BadRequestError("Only DRAFT invoices can be deleted");
    }

    await prisma.invoice.delete({
      where: { id: existing.id },
    });

    return { message: `Invoice '${existing.invoiceNumber}' deleted successfully` };
  }

  async issueInvoice(id: string) {
    const invoice = await this.getById(id);

    if (invoice.status === "ISSUED") {
      throw new ConflictError("Invoice is already issued");
    }

    if (invoice.status === "CANCELED") {
      throw new BadRequestError("Cannot issue a canceled invoice");
    }

    const issuedAt = new Date();

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "ISSUED",
        issuedAt,
      },
    });

    return {
      id: updated.id,
      invoiceNumber: updated.invoiceNumber,
      status: updated.status,
      issuedAt: updated.issuedAt,
    };
  }

  async cancelInvoice(id: string) {
    const invoice = await this.getById(id);

    if (invoice.status === "CANCELED") {
      throw new BadRequestError("Invoice is already canceled");
    }

    const canceledAt = new Date();

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELED",
        canceledAt,
      },
      include: {
        items: true,
      },
    });

    return updated;
  }

  async replaceInvoice(id: string, input: ReplaceInvoiceInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Validate original invoice
      const oldInvoice = await tx.invoice.findFirst({
        where: {
          OR: [{ id }, { invoiceNumber: id }],
        },
      });

      if (!oldInvoice) {
        throw new NotFoundError(`Original invoice '${id}' not found`);
      }

      if (oldInvoice.status === "DRAFT") {
        throw new BadRequestError(
          "Cannot replace a DRAFT invoice. Only ISSUED invoices can be replaced."
        );
      }

      if (oldInvoice.status === "CANCELED") {
        throw new BadRequestError(
          "Cannot replace a CANCELED invoice. Only ISSUED invoices can be replaced."
        );
      }

      // 2. Cancel old invoice
      await tx.invoice.update({
        where: { id: oldInvoice.id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        },
      });

      // 3. Calculate totals for new invoice
      const taxRate = input.taxRate ?? 10;
      const { subtotal, tax, total } = this.calculateTotals(input.items, taxRate);

      // 4. Generate new invoice number
      const newInvoiceNumber = await this.generateInvoiceNumber(tx as typeof prisma);

      // 5. Create replacement invoice linked to old invoice
      const replacementInvoice = await tx.invoice.create({
        data: {
          invoiceNumber: newInvoiceNumber,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          status: "DRAFT",
          subtotal,
          tax,
          total,
          replacedInvoiceId: oldInvoice.id,
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
            })),
          },
        },
        include: {
          items: true,
          replacedInvoice: {
            select: { id: true, invoiceNumber: true, status: true },
          },
        },
      });

      return replacementInvoice;
    });
  }


  //Tạo PDF invoices
  async generatePdf(id: string) {
    const invoice = await this.getById(id);
    const doc = pdfService.generateInvoicePdf(invoice);

    return {
      invoice,
      doc,
      filename: `${invoice.invoiceNumber}.pdf`,
    };
  }
}

export const invoiceService = new InvoiceService();

