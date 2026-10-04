import assert from "node:assert/strict";
import test from "node:test";
import { EvolutionError } from "./evolution-client.js";
import {
  contentDispositionFor,
  downloadMedia,
  formatAudioPreview,
  mediaRetryDelayMs,
  MEDIA_MAX_ATTEMPTS,
  mediaContentSecurityPolicy,
  parseByteRange,
  servedContentType
} from "./media.js";

test("Content-Type servido respeita a lista permitida", () => {
  assert.equal(servedContentType("image/jpeg"), "image/jpeg");
  assert.equal(servedContentType("audio/ogg; codecs=opus"), "audio/ogg; codecs=opus");
  assert.equal(servedContentType("AUDIO/MP4"), "audio/mp4");
  assert.equal(servedContentType("application/pdf"), "application/pdf");
  assert.equal(
    servedContentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(servedContentType("text/plain; charset=utf-8"), "text/plain; charset=utf-8");
  assert.equal(servedContentType("image/svg+xml"), "application/octet-stream");
  assert.equal(servedContentType("text/html"), "application/octet-stream");
  assert.equal(servedContentType("application/javascript"), "application/octet-stream");
  assert.equal(servedContentType("audio/ogg; codecs=\"opus\"\r\nX-Evil: 1"), "audio/ogg");
  assert.equal(servedContentType(null), "application/octet-stream");
  assert.equal(servedContentType(""), "application/octet-stream");
});

test("Content-Disposition é inline só para imagem, áudio, vídeo e PDF", () => {
  assert.equal(contentDispositionFor("image/jpeg", null, "abc", false), "inline");
  assert.equal(contentDispositionFor("audio/ogg; codecs=opus", null, "abc", false), "inline");
  assert.equal(contentDispositionFor("application/pdf", "Contrato.pdf", "abc", false), "inline; filename=\"Contrato.pdf\"; filename*=UTF-8''Contrato.pdf");
  assert.equal(
    contentDispositionFor("application/octet-stream", "../../etc/pass\"wd", "abc", false),
    "attachment; filename=\"etc_pass_wd\"; filename*=UTF-8''etc_pass_wd"
  );
  assert.equal(
    contentDispositionFor("application/msword", "Orçamento março.doc", "abc", false),
    "attachment; filename=\"Or_amento mar_o.doc\"; filename*=UTF-8''Or%C3%A7amento%20mar%C3%A7o.doc"
  );
  assert.equal(
    contentDispositionFor("image/jpeg", null, "1234abcd-ffff", true),
    "attachment; filename=\"whatsapp-1234abcd.jpg\"; filename*=UTF-8''whatsapp-1234abcd.jpg"
  );
  assert.equal(
    contentDispositionFor("audio/ogg; codecs=opus", "", "1234abcd-ffff", true),
    "attachment; filename=\"whatsapp-1234abcd.ogg\"; filename*=UTF-8''whatsapp-1234abcd.ogg"
  );
  const long = contentDispositionFor("application/pdf", `${"a".repeat(300)}.pdf`, "x", true);
  assert.ok(long.length < 400);
  assert.match(long, /\.pdf"/);
  assert.doesNotMatch(contentDispositionFor("application/pdf", "a\r\nb;c'd.pdf", "x", true), /[\r\n]/);
});

test("interpreta um único intervalo de bytes", () => {
  assert.equal(parseByteRange(undefined, 100), null);
  assert.deepEqual(parseByteRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-500", 100), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=50-500", 100), { start: 50, end: 99 });
  assert.equal(parseByteRange("bytes=100-", 100), "unsatisfiable");
  assert.equal(parseByteRange("bytes=-0", 100), "unsatisfiable");
  assert.equal(parseByteRange("bytes=0-0", 0), "unsatisfiable");
  // Inválidos ou múltiplos são ignorados: resposta completa (200).
  assert.equal(parseByteRange("bytes=9-0", 100), null);
  assert.equal(parseByteRange("bytes=0-1,5-6", 100), null);
  assert.equal(parseByteRange("items=0-1", 100), null);
  assert.equal(parseByteRange("bytes=abc", 100), null);
  assert.equal(parseByteRange("bytes=-", 100), null);
});

test("nova tentativa segue 30 s, 2 min, 10 min, 30 min e desiste na quinta", () => {
  assert.equal(MEDIA_MAX_ATTEMPTS, 5);
  assert.equal(mediaRetryDelayMs(1), 30_000);
  assert.equal(mediaRetryDelayMs(2), 120_000);
  assert.equal(mediaRetryDelayMs(3), 600_000);
  assert.equal(mediaRetryDelayMs(4), 1_800_000);
  assert.equal(mediaRetryDelayMs(5), null);
  assert.equal(mediaRetryDelayMs(9), null);
});

test("prévia do áudio mostra a duração quando conhecida", () => {
  assert.equal(formatAudioPreview(12), "Áudio (0:12)");
  assert.equal(formatAudioPreview(65), "Áudio (1:05)");
  assert.equal(formatAudioPreview(3723), "Áudio (1:02:03)");
  assert.equal(formatAudioPreview(null), "Áudio");
  assert.equal(formatAudioPreview(undefined), "Áudio");
});

function fakeClient(responses: Array<{ mimetype: string | null; base64: string } | Error>) {
  const calls: Array<{ id: string; convertToMp4: boolean }> = [];
  return {
    calls,
    async getMediaBase64(id: string, options: { convertToMp4: boolean }) {
      calls.push({ id, convertToMp4: options.convertToMp4 });
      const next = responses.shift();
      if (!next) throw new Error("sem resposta");
      if (next instanceof Error) throw next;
      return next;
    }
  };
}

test("áudio pede MP4 e volta ao original quando a conversão falha", async () => {
  const converted = fakeClient([{ mimetype: "audio/mp4", base64: "AAEC" }]);
  const ok = await downloadMedia(converted, { providerMessageId: "p1", mediaType: "audio", maxBytes: 100 });
  assert.equal(ok.status, "ready");
  assert.deepEqual(converted.calls, [{ id: "p1", convertToMp4: true }]);

  const fallback = fakeClient([new EvolutionError("evolution_4xx", 400), { mimetype: "audio/ogg; codecs=opus", base64: "AAEC" }]);
  const original = await downloadMedia(fallback, { providerMessageId: "p2", mediaType: "audio", maxBytes: 100 });
  assert.deepEqual(fallback.calls.map((call) => call.convertToMp4), [true, false]);
  assert.equal(original.status === "ready" ? original.mimetype : null, "audio/ogg; codecs=opus");
  assert.deepEqual(original.status === "ready" ? [...original.data] : null, [0, 1, 2]);

  const image = fakeClient([{ mimetype: "image/jpeg", base64: "AAEC" }]);
  await downloadMedia(image, { providerMessageId: "p3", mediaType: "image", maxBytes: 100 });
  assert.deepEqual(image.calls, [{ id: "p3", convertToMp4: false }]);
});

test("download sem rede não tenta sem conversão; maior que o limite vira too_large", async () => {
  const offline = fakeClient([new EvolutionError("timeout")]);
  await assert.rejects(
    downloadMedia(offline, { providerMessageId: "p4", mediaType: "audio", maxBytes: 100 }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "timeout"
  );
  assert.equal(offline.calls.length, 1);

  const big = fakeClient([{ mimetype: "image/jpeg", base64: Buffer.alloc(101).toString("base64") }]);
  assert.deepEqual(await downloadMedia(big, { providerMessageId: "p5", mediaType: "image", maxBytes: 100 }), { status: "too_large" });

  const declared = fakeClient([new EvolutionError("too_large")]);
  assert.deepEqual(await downloadMedia(declared, { providerMessageId: "p6", mediaType: "video", maxBytes: 100 }), { status: "too_large" });

  const imageError = fakeClient([new EvolutionError("evolution_5xx", 500)]);
  await assert.rejects(downloadMedia(imageError, { providerMessageId: "p7", mediaType: "image", maxBytes: 100 }));
  assert.equal(imageError.calls.length, 1);
});

test("nome de arquivo perde caracteres bidi/invisíveis que disfarçam a extensão", () => {
  assert.equal(
    contentDispositionFor("application/octet-stream", "reserva‮fdp.exe", "abc", false),
    "attachment; filename=\"reservafdp.exe\"; filename*=UTF-8''reservafdp.exe"
  );
  assert.equal(
    contentDispositionFor("application/pdf", "a⁦b⁩‏c​.pdf", "abc", true),
    "attachment; filename=\"abc.pdf\"; filename*=UTF-8''abc.pdf"
  );
});

test("CSP estrita para tudo, exceto PDF aberto inline", () => {
  assert.equal(mediaContentSecurityPolicy("image/jpeg", "inline"), "default-src 'none'; sandbox");
  assert.equal(mediaContentSecurityPolicy("application/octet-stream", "attachment; filename=\"x\""), "default-src 'none'; sandbox");
  assert.equal(mediaContentSecurityPolicy("application/pdf", "attachment; filename=\"x.pdf\""), "default-src 'none'; sandbox");
  const pdfInline = mediaContentSecurityPolicy("application/pdf", "inline; filename=\"x.pdf\"");
  assert.doesNotMatch(pdfInline, /sandbox/);
  assert.match(pdfInline, /default-src 'none'/);
});
