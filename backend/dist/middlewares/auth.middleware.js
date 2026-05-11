import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
function getCookieValue(cookieHeader, cookieName) {
    if (!cookieHeader)
        return null;
    const cookies = cookieHeader.split(";").map((part) => part.trim());
    const found = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
    if (!found)
        return null;
    const [, value = ""] = found.split("=");
    return decodeURIComponent(value);
}
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const cookieToken = getCookieValue(req.headers.cookie, env.AUTH_COOKIE_NAME);
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice("Bearer ".length);
    }
    else if (cookieToken) {
        token = cookieToken;
    }
    if (!token) {
        res.status(401).json({ message: "Token nÃo informado." });
        return;
    }
    try {
        req.user = verifyAccessToken(token);
        next();
    }
    catch {
        res.clearCookie(env.AUTH_COOKIE_NAME, {
            httpOnly: true,
            sameSite: "lax",
            secure: env.NODE_ENV === "production",
            path: "/"
        });
        res.status(401).json({ message: "Token invÃ¡lido ou expirado." });
    }
}
