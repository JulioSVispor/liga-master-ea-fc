import QueryProvider from "@/providers/QueryProvider";
import { requireAdmin } from "@/lib/supabase/server-auth";

export default async function AdminTemplate({ children }) {
  await requireAdmin();
  return <QueryProvider>{children}</QueryProvider>;
}
