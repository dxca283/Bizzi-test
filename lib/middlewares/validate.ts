import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

type ValidationSource = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: ValidationSource = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === "body") {
        req.body = parsed;
      } else if (source === "query") {
        Object.assign(req.query, parsed);
      } else if (source === "params") {
        Object.assign(req.params, parsed);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

