import fs from "node:fs/promises";
import { webBlobUrl, webFilePath } from "@/lib/storage";
import { blobEnabled } from "@/lib/env";

const TYPES: Record<string, string> = { webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Sirve las versiones web de fotos y vídeos (sin metadatos). Los originales solo se descargan desde el panel. */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file;
  if (blobEnabled()) {
    // Almacén privado: redirige a un enlace firmado de 1 h. El navegador puede reutilizar la redirección 10 min.
    const url = await webBlobUrl(name).catch(() => null);
    if (!url) return new Response("No encontrado", { status: 404 });
    return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "public, max-age=600", "X-Content-Type-Options": "nosniff" } });
  }
  const p = webFilePath(name);
  if (!p) return new Response("No encontrado", { status: 404 });
  try {
    const stat = await fs.stat(p);
    const type = TYPES[name.split(".").pop()!] ?? "application/octet-stream";
    const range = req.headers.get("range");
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };
    if (range && type.startsWith("video/")) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      const start = m?.[1] ? Number(m[1]) : 0;
      const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : Math.min(start + 4 * 1024 * 1024, stat.size - 1);
      if (start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
      const fh = await fs.open(p);
      const buf = new Uint8Array(end - start + 1);
      await fh.read(buf, 0, buf.length, start);
      await fh.close();
      return new Response(buf, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(buf.length) } });
    }
    const data = new Uint8Array(await fs.readFile(p));
    return new Response(data, { headers: { ...headers, "Content-Length": String(data.length) } });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
