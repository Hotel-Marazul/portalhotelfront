import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";

function getDatabaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details
    });
    return;
  }

  switch (getDatabaseErrorCode(error)) {
    case "23P01":
      res.status(409).json({ message: "O quarto já possui uma reserva ativa nesse período." });
      return;
    case "23505":
      res.status(409).json({ message: "Já existe um registro com os mesmos dados." });
      return;
    case "23503":
      res.status(409).json({ message: "Não é possível concluir a operação porque há registros relacionados." });
      return;
    case "23514":
    case "23502":
      res.status(400).json({ message: "Os dados informados violam uma regra do sistema." });
      return;
    default:
      break;
  }

  res.status(500).json({ message: "Erro interno do servidor." });
}
