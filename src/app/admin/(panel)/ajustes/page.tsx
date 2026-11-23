import Link from "next/link";
import { getSettings, pendingConfirmations } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";

const SECTIONS = [
  { key: "negocio", title: "Datos de Candú", desc: "Nombre visible, contacto, dirección, historia y textos de la web" },
  { key: "entregas", title: "Entregas y localidades", desc: "Recogida, localidades, costes, pedido mínimo, franjas y condiciones" },
  { key: "pagos", title: "Pagos", desc: "Pago al recibir y textos de los métodos de pago" },
  { key: "catalogo", title: "Catálogo y filtros", desc: "Categorías, temporadas y mensaje de catálogo vacío" },
  { key: "estados", title: "Estados del pedido", desc: "Textos que ve el cliente en el seguimiento" },
  { key: "galeria", title: "Galería del obrador", desc: "Fotos reales de la portada" },
  { key: "privacidad", title: "Privacidad y ubicación", desc: "Cuándo se borra la ubicación del reparto" },
  { key: "datos-legales", title: "Datos legales obligatorios", desc: "Titular, NIF/DNI, domicilio, registro sanitario, IVA y hojas de reclamaciones" },
  { key: "legal", title: "Textos legales", desc: "Aviso legal, privacidad, cookies y condiciones" },
  { key: "integraciones", title: "Conexiones", desc: "Qué está conectado, en prueba o pendiente" },
  { key: "registro", title: "Registro de incidencias", desc: "Errores de pagos, mensajería y reparto" },
];

export default async function Settings() {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const pending = pendingConfirmations(await getSettings());
  return (
    <>
      <h1>Ajustes</h1>
      {pending.length > 0 && (
        <div className="notice notice--warn stack" style={{ marginBottom: 16, gap: 6 }}>
          {pending.map((p) => (
            <span key={p}>⚠️ {p}</span>
          ))}
        </div>
      )}
      {SECTIONS.map((s) => (
        <Link key={s.key} href={`/admin/ajustes/${s.key}`} className="card card-link">
          <strong style={{ fontSize: "1.08rem" }}>{s.title}</strong>
          <div className="meta">{s.desc}</div>
        </Link>
      ))}
    </>
  );
}
