import QueryProvider from "@/providers/QueryProvider";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";

export default async function DashboardTemplate({ children }) {
  await requireAuthenticatedUser();
  return <QueryProvider>{children}</QueryProvider>;
}
