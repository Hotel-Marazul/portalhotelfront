import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function signAccessToken(user) {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role
    };
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN
    });
}
export function verifyAccessToken(token) {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return {
        id: payload.sub,
        email: payload.email,
        role: payload.role
    };
}
