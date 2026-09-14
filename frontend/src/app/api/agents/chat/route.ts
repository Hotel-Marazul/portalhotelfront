import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
).replace(/\/+$/, "");

function authHeaders(request: NextRequest, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function backendAgentRequest(request: NextRequest, path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${BACKEND_API_URL}/api/agent${path}`, {
      ...init,
      headers: {
        ...authHeaders(request, Boolean(init.body)),
        ...(init.headers ?? {})
      },
      signal: init.signal ?? request.signal,
      cache: "no-store"
    });
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const upstream = await backendAgentRequest(request, "/health");
  if (!upstream) return NextResponse.json({ ok: false, message: "Falha ao conectar com o agente." }, { status: 502 });
  const body = await upstream.text();
  let data: unknown = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { message: "Resposta inválida do gateway." }; }
  return NextResponse.json(upstream.ok ? { ok: true, ...(data as object) } : data, { status: upstream.status });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  const upstream = await backendAgentRequest(request, "/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!upstream) return NextResponse.json({ message: "Falha ao conectar com o gateway do agente." }, { status: 502 });

  const text = await upstream.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: "Resposta inválida do gateway." }; }
  return NextResponse.json(body, { status: upstream.status });
}
