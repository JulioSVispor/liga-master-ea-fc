import DashboardLayoutClient from "./DashboardLayoutClient";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";

export default async function DashboardLayout({ children }) {
  const { supabase, user } = await requireAuthenticatedUser();
  const [{ data: profile }, { data: team }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, badge_url, budget, max_wage_cap")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <DashboardLayoutClient initialProfile={profile} initialTeam={team}>
      {children}
    </DashboardLayoutClient>
  );
}
