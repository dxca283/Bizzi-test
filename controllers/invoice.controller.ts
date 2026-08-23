import type { Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/invoice.service.js";
import type { ListInvoicesQuery } from "../lib/schemas/invoice.schema.js";

export class InvoiceController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.createDraft(req.body);
      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.getAll(
        req.query as unknown as ListInvoicesQuery
      );
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }


  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const invoice = await invoiceService.getById(id);
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const invoice = await invoiceService.updateDraft(id, req.body);
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const result = await invoiceService.deleteInvoice(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async issue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const result = await invoiceService.issueInvoice(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const result = await invoiceService.cancelInvoice(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async replace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const result = await invoiceService.replaceInvoice(id, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { doc, filename } = await invoiceService.generatePdf(id);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      doc.pipe(res);
      doc.end();
    } catch (error) {
      next(error);
    }
  }
}


export const invoiceController = new InvoiceController();
