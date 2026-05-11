import { env } from "./env.js";
const origins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
export const corsOptions = {
    origin(requestOrigin, callback) {
        if (!requestOrigin || origins.includes(requestOrigin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
};
