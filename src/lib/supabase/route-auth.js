import "server-only";
import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient as createServiceRoleClient } from "@/lib/supabase/server";

function createRequestClient(cookieStore) {
  return createSsrServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // These handlers only validate an existing session.
        },
      },
    }
  );
}

export async function requireAdminUser() {
  const cookieStore = await cookies();
  const supabase = createRequestClient(cookieStore);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { error: "Não autenticado", status: 401 };

  const serviceClient = createServiceRoleClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !["admin", "master"].includes(profile.role)) {
    return { error: "Acesso negado", status: 403 };
  }

  return { user, serviceClient };
}

export async function requireRequestUser(request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) return { error: "Não autenticado", status: 401 };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return { error: "Não autenticado", status: 401 };
  return { user, userClient: supabase, serviceClient: createServiceRoleClient() };
}
