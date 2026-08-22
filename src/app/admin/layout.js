import AdminLayoutClient from "./AdminLayoutClient";
import { requireAdmin } from "@/lib/supabase/server-auth";

export default async function AdminLayout({ children }) {
  const { profile } = await requireAdmin();

  return (
    <AdminLayoutClient
      initialAdmin={{
        displayName: profile.display_name || "Administrador",
        role: profile.role,
      }}
    >
      {children}
    </AdminLayoutClient>
  );
}
