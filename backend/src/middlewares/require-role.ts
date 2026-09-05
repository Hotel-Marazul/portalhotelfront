import { NextFunction, Request, Response } from "express";
import { AuthUser } from "../types/auth.js";

export function requireRole(...allowedRoles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Você não tem permissão para realizar esta operação." });
      return;
    }

    next();
  };
}
