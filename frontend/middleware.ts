import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";
const PUBLIC_PATHS = new Set(["/login"]);

// Igual a homePathFor de src/config/navigation.ts: o middleware fica sem imports locais.
function homePathFor(role: string | undefined): string {
  return role === "admin" ? "/gestao" : "/dashboard";
}

function parseJwtPayload(token: string): { exp?: number; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const parsed = JSON.parse(atob(normalized)) as { exp?: number; role?: string };
    return parsed;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The hotel website is public for visitors and signed-in staff alike.
  if (pathname === "/") return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (token && isTokenExpired(token)) {
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // O papel no token só decide para onde mandar; quem barra os dados é o backend.
  const role = token ? parseJwtPayload(token)?.role : undefined;

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL(homePathFor(role), request.url));
  }

  if (pathname === "/gestao" && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
