import { CorsOptions } from "cors";
import { HttpError } from "../utils/http-error.js";
import { env } from "./env.js";

const origins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

export const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    if (!requestOrigin || origins.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    // Vale para qualquer método: um POST vindo de outra origem também para aqui (CSRF).
    callback(new HttpError(403, "Origem não permitida."));
  },
  credentials: true
};
