"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createDraftAction } from "@/app/admin/actions";

interface Uploaded {
  id: string;
  kind: "image" | "video";
  thumbUrl: string | null;
  url: string;
  needsConversion: boolean;
}

/** ¿El servidor guarda los archivos en Vercel Blob? Entonces se sube directamente desde el navegador. */
function cloudUpload(): boolean {
  return typeof document !== "undefined" && Boolean(document.querySelector('[data-cloud-upload="1"]'));
}

/**
 * Subida directa al almacén privado de Vercel Blob (sin pasar por la función, que solo admite 4,5 MB)
 * y registro posterior: el servidor comprueba el tipo real del archivo antes de aceptarlo.
 */
async function uploadCloud(file: File, onProgress: (p: number) => void): Promise<Uploaded> {
  const { upload } = await import("@vercel/blob/client");
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  let blob;
  try {
    blob = await upload(`incoming/subida.${ext}`, file, {
      access: "private",
      handleUploadUrl: "/api/admin/blob-token",
      multipart: file.size > 25 * 1024 * 1024,
      onUploadProgress: (e) => onProgress(Math.min(0.95, e.percentage / 100)),
    });
  } catch (e) {
    throw new Error(/content type|tipo/i.test(String(e)) ? "Formato no admitido. Usa fotos o vídeos." : /size|grande/i.test(String(e)) ? "El archivo es demasiado grande (máx. 120 MB)." : "No se pudo subir. Revisa la conexión e inténtalo de nuevo.");
  }
  const res = await fetch("/api/admin/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname: blob.pathname, name: file.name.slice(0, 200) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el archivo.");
  onProgress(1);
  return data.media as Uploaded;
}

/** Sube un archivo con barra de progreso (XMLHttpRequest permite medir el avance). */
function uploadOne(file: File, onProgress: (p: number) => void): Promise<Uploaded> {
  if (cloudUpload()) return uploadCloud(file, onProgress);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.media as Uploaded);
        else reject(new Error(data.error ?? "No se pudo subir el archivo."));
      } catch {
        reject(new Error("Respuesta no válida del servidor."));
      }
    };
    xhr.onerror = () => reject(new Error("Sin conexión. Inténtalo de nuevo."));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

/**
 * Bandeja de entrada: Juani elige fotos/vídeos del móvil (o los que preparó para un Estado de WhatsApp)
 * y se crea un BORRADOR. Nada se publica hasta que ella lo revise y pulse «Publicar».
 */
export function Uploader({ mode = "draft", onUploaded }: { mode?: "draft" | "append"; onUploaded?: (m: Uploaded[]) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ name: string; progress: number; error?: string; done?: Uploaded }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function handle(list: FileList | null) {
    if (!list?.length) return;
    const arr = Array.from(list).slice(0, 20);
    setBusy(true);
    setFiles(arr.map((f) => ({ name: f.name, progress: 0 })));
    const done: Uploaded[] = [];
    for (const [i, f] of arr.entries()) {
      try {
        const m = await uploadOne(f, (p) => setFiles((s) => s.map((x, j) => (j === i ? { ...x, progress: p } : x))));
        done.push(m);
        setFiles((s) => s.map((x, j) => (j === i ? { ...x, progress: 1, done: m } : x)));
      } catch (e) {
        setFiles((s) => s.map((x, j) => (j === i ? { ...x, error: (e as Error).message } : x)));
      }
    }
    if (mode === "append") {
      onUploaded?.(done);
      setBusy(false);
      setFiles([]);
      return;
    }
    if (done.length) {
      const id = await createDraftAction(
        done.map((d) => d.id),
        notes,
      );
      router.push(`/admin/productos/${id}?nuevo=1`);
    } else setBusy(false);
  }

  return (
    <div className="stack">
      {mode === "draft" && (
        <label className="field">
          <span>Notas para la descripción (opcional)</span>
          <textarea
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lo que quieras que aparezca: nombre, sabores, para cuántas personas… Se usará como borrador, nunca se inventa nada."
          />
        </label>
      )}
      <label
        className="dropzone"
        data-over={over ? "1" : "0"}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
      >
        <input ref={input} type="file" accept="image/*,video/*" multiple hidden disabled={busy} onChange={(e) => handle(e.target.files)} />
        <span style={{ fontSize: "2.4rem" }} aria-hidden>
          📷
        </span>
        <strong style={{ fontSize: "1.15rem" }}>{mode === "draft" ? "Elegir fotos o vídeos" : "Añadir más fotos o vídeos"}</strong>
        <span className="meta">Desde la galería, la cámara o los archivos que preparaste para un Estado. Se guarda siempre el original.</span>
      </label>
      {files.length > 0 && (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-live="polite">
          {files.map((f, i) => (
            <li key={i} className="card" style={{ padding: 12 }}>
              <div className="row">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span className={f.error ? "err-text" : "meta"}>{f.error ? "Error" : f.done ? "✓" : `${Math.round(f.progress * 100)} %`}</span>
              </div>
              {f.error && <p className="err-text" style={{ margin: "6px 0 0", fontSize: ".9rem" }}>{f.error}</p>}
              {f.done?.needsConversion && <p className="meta" style={{ margin: "6px 0 0" }}>Guardado, pero no se pudo convertir para la web (por ejemplo HEIC). Súbelo también en JPG.</p>}
            </li>
          ))}
        </ul>
      )}
      {busy && mode === "draft" && <p className="meta">Subiendo y preparando el borrador…</p>}
    </div>
  );
}
