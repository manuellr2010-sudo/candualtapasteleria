import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";
import { logoutAction } from "../actions";
import { blobEnabled, isPreview, persistentDb, persistentFiles } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [row] = await all<{ n: number }>(`SELECT COUNT(*) AS n FROM orders WHERE status = 'received' AND payment_status IN ('paid','cod_pending')`);
  return (
    <>
      <header className="adm-top">
        <Link href="/admin" className="adm-brand">
          Candú <small>panel</small>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/" className="btn btn--ghost btn--sm" target="_blank">
            <span>Ver web</span>
          </Link>
          <form action={logoutAction}>
            <button className="btn btn--light btn--sm">
              <span>Salir</span>
            </button>
          </form>
        </div>
      </header>
      <main className="adm-main" data-cloud-upload={blobEnabled() ? "1" : "0"}>
        {isPreview() && (
          <p className="notice" role="note" style={{ marginBottom: 12 }}>
            <strong>Vista previa.</strong> No es la web oficial. Los pagos están en modo prueba o desactivados: no uses datos reales de clientes.
          </p>
        )}
        {(!persistentDb() || !persistentFiles()) && (
          <p className="notice notice--warn" role="alert" style={{ marginBottom: 12 }}>
            <strong>Almacenamiento temporal.</strong>{" "}
            {!persistentDb() && "Los pedidos, productos y ajustes que guardes aquí pueden perderse al reiniciarse el servidor. "}
            {!persistentFiles() && "Las fotos y vídeos subidos también. "}
            Falta conectar la base de datos y el almacén de archivos (Ajustes › Integraciones).
          </p>
        )}
        {children}
      </main>
      <AdminNav newOrders={Number(row?.n ?? 0)} />
    </>
  );
}
