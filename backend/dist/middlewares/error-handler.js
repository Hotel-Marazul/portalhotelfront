import { HttpError } from "../utils/http-error.js";
export function errorHandler(error, _req, res, _next) {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({
            message: error.message,
            details: error.details
        });
        return;
    }
    res.status(500).json({ message: "Erro interno do servidor." });
}
