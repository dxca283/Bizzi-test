import PDFDocument from "pdfkit";

export interface InvoiceItemData {
  description: string;
  quantity: number | string | { toString(): string };
  unitPrice: number | string | { toString(): string };
  amount: number | string | { toString(): string };
}

export interface InvoicePdfData {
  id: string;
  invoiceNumber: string;
  status: string;
  customerName: string;
  customerEmail?: string | null;
  subtotal: number | string | { toString(): string };
  tax: number | string | { toString(): string };
  total: number | string | { toString(): string };
  createdAt: Date | string;
  issuedAt?: Date | string | null;
  canceledAt?: Date | string | null;
  replacedInvoiceId?: string | null;
  items: InvoiceItemData[];
}

export class PdfService {
  generateInvoicePdf(invoice: InvoicePdfData): PDFKit.PDFDocument {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: "Invoice Management System",
      },
    });

    const primaryColor = "#2563EB";
    const darkColor = "#1E293B";
    const lightGray = "#E2E8F0";
    const mutedColor = "#64748B";

    // --- HEADER ---
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("INVOICE", 50, 50);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text("Official Electronic Invoice", 50, 80);

    // Invoice Meta (Top Right)
    const dateFormatted = invoice.issuedAt
      ? new Date(invoice.issuedAt).toLocaleDateString("en-GB")
      : new Date(invoice.createdAt).toLocaleDateString("en-GB");

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(darkColor)
      .text(`Invoice No:`, 380, 55, { width: 80, align: "left" })
      .font("Helvetica")
      .text(invoice.invoiceNumber, 460, 55, { align: "right" });

    doc
      .font("Helvetica-Bold")
      .text(`Date:`, 380, 70, { width: 80, align: "left" })
      .font("Helvetica")
      .text(dateFormatted, 460, 70, { align: "right" });

    doc
      .font("Helvetica-Bold")
      .text(`Status:`, 380, 85, { width: 80, align: "left" })
      .font("Helvetica-Bold")
      .fillColor(
        invoice.status === "ISSUED"
          ? "#16A34A"
          : invoice.status === "CANCELED"
          ? "#DC2626"
          : "#D97706"
      )
      .text(invoice.status, 460, 85, { align: "right" });

    // Divider
    doc
      .moveTo(50, 110)
      .lineTo(545, 110)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    // --- BILL TO / CUSTOMER INFO ---
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(darkColor)
      .text("BILLED TO:", 50, 125);

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(darkColor)
      .text(invoice.customerName, 50, 142);

    if (invoice.customerEmail) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(mutedColor)
        .text(invoice.customerEmail, 50, 158);
    }

    // Divider before table
    doc
      .moveTo(50, 185)
      .lineTo(545, 185)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    // --- ITEMS TABLE HEADER ---
    const tableTop = 200;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(darkColor)
      .text("Item / Description", 50, tableTop)
      .text("Qty", 280, tableTop, { width: 50, align: "center" })
      .text("Unit Price", 340, tableTop, { width: 90, align: "right" })
      .text("Amount", 445, tableTop, { width: 100, align: "right" });

    doc
      .moveTo(50, tableTop + 16)
      .lineTo(545, tableTop + 16)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    // --- ITEMS ROWS ---
    let currentY = tableTop + 26;
    doc.font("Helvetica").fontSize(10).fillColor(darkColor);

    for (const item of invoice.items) {
      doc
        .text(item.description, 50, currentY, { width: 220 })
        .text(String(item.quantity), 280, currentY, {
          width: 50,
          align: "center",
        })
        .text(Number(item.unitPrice).toFixed(2), 340, currentY, {
          width: 90,
          align: "right",
        })
        .text(Number(item.amount).toFixed(2), 445, currentY, {
          width: 100,
          align: "right",
        });

      currentY += 22;
    }

    // Divider after items
    doc
      .moveTo(50, currentY + 5)
      .lineTo(545, currentY + 5)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    currentY += 20;

    // --- TOTALS SUMMARY ---
    const summaryX = 350;
    const valueX = 445;
    const summaryWidth = 100;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(mutedColor)
      .text("Subtotal:", summaryX, currentY)
      .fillColor(darkColor)
      .text(Number(invoice.subtotal).toFixed(2), valueX, currentY, {
        width: summaryWidth,
        align: "right",
      });

    currentY += 18;

    doc
      .fillColor(mutedColor)
      .text("Tax:", summaryX, currentY)
      .fillColor(darkColor)
      .text(Number(invoice.tax).toFixed(2), valueX, currentY, {
        width: summaryWidth,
        align: "right",
      });

    currentY += 20;

    doc
      .moveTo(summaryX, currentY - 4)
      .lineTo(545, currentY - 4)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(primaryColor)
      .text("TOTAL:", summaryX, currentY)
      .text(Number(invoice.total).toFixed(2), valueX, currentY, {
        width: summaryWidth,
        align: "right",
      });

    // --- FOOTER NOTE ---
    currentY += 50;
    doc
      .moveTo(50, currentY)
      .lineTo(545, currentY)
      .strokeColor(lightGray)
      .lineWidth(1)
      .stroke();

    currentY += 15;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(mutedColor)
      .text(
        "Thank you for your business! If you have questions about this invoice, please contact support.",
        50,
        currentY,
        { align: "center", width: 495 }
      );

    return doc;
  }
}

export const pdfService = new PdfService();
