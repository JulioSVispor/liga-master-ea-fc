import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";

export async function createAuthenticatedServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components não podem persistir cookies; o middleware/cliente renova a sessão.
          }
        },
      },
    }
  );
}

export async function requireAuthenticatedUser() {
  const supabase = await createAuthenticatedServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single();
  if (error || !profile || !["admin", "master"].includes(profile.role)) forbidden();
  return { supabase, user, profile };
}
