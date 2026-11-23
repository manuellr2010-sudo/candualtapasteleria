import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authConfigured, isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Acceso" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const cfg = authConfigured();
  return (
    <div className="adm-login">
      <LoginForm configured={cfg.ok} reason={cfg.reason} />
    </div>
  );
}
