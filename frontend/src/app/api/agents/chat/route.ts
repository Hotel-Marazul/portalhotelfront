import { NextResponse } from "next/server";

const AGENTS_API_URL = process.env.AGENTS_API_URL ?? "http://localhost:5051";

export async function GET() {
  try {
    const upstream = await fetch(`${AGENTS_API_URL}/health`, {
      method: "GET",
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, message: "Agente indisponivel.", status: upstream.status },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, message: "Falha ao conectar com o agente." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const upstream = await fetch(`${AGENTS_API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const text = await upstream.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ message: "Falha ao enviar mensagem para o agente." }, { status: 502 });
  }
}
