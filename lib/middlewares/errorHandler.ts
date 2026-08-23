import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.constructor.name,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  // Handle Prisma errors if applicable
  if (err && typeof err === "object" && "code" in err) {
    const prismaError = err as { code: string; message: string; meta?: unknown };
    if (prismaError.code === "P2002") {
      res.status(409).json({
        success: false,
        error: {
          code: "UNIQUE_CONSTRAINT_FAILED",
          message: "A record with this identifier already exists",
          details: prismaError.meta ?? null,
        },
      });
      return;
    }
    if (prismaError.code === "P2025") {
      res.status(404).json({
        success: false,
        error: {
          code: "RECORD_NOT_FOUND",
          message: "Requested database record was not found",
        },
      });
      return;
    }
  }

  // Handle unexpected errors
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred on the server",
    },
  });
}
