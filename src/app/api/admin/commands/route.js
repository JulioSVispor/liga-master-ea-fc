import { NextResponse } from "next/server";
import { READ_ONLY_MODE } from "@/lib/maintenance";
import { requireAdminUser } from "@/lib/supabase/route-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText(value, max, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`${field} inválido.`);
  return text;
}

function optionalText(value, max, field) {
  if (value == null || value === "") return null;
  return requiredText(value, max, field);
}

function uuid(value, field) {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${field} inválido.`);
  return value;
}

async function runCommand(command, payload, serviceClient, actorId) {
  switch (command) {
    case "invite.create": {
      const email = requiredText(payload.email, 320, "E-mail").toLowerCase();
      if (!EMAIL.test(email)) throw new Error("E-mail inválido.");
      return serviceClient.from("allowed_emails").insert({
        email,
        display_name: optionalText(payload.displayName, 100, "Nome"),
        added_by: actorId,
      }).select("id, email, display_name, used, created_at").single();
    }
    case "invite.remove":
      return serviceClient.from("allowed_emails").delete().eq("id", uuid(payload.id, "Convite"))
        .eq("used", false).select("id").single();
    case "news.create": {
      const teamId = payload.teamId ? uuid(payload.teamId, "Clube") : null;
      let badgeUrl = null;
      if (teamId) {
        const team = await serviceClient.from("teams").select("badge_url").eq("id", teamId).single();
        if (team.error) return team;
        badgeUrl = team.data.badge_url;
      }
      if (!["admin", "general", "finance", "transfer"].includes(payload.category)) {
        throw new Error("Categoria inválida.");
      }
      return serviceClient.from("market_news").insert({
        title: requiredText(payload.title, 160, "Título"),
        content: requiredText(payload.content, 5000, "Conteúdo"),
        category: payload.category,
        team_id: teamId,
        badge_url: badgeUrl,
      }).select("id").single();
    }
    case "news.remove":
      return serviceClient.from("market_news").delete().eq("id", uuid(payload.id, "Notícia"))
        .select("id").single();
    case "waitlist.create":
      return serviceClient.from("waitlist").insert({
        name: requiredText(payload.name, 120, "Nome"),
        whatsapp: requiredText(payload.whatsapp, 40, "WhatsApp"),
        email: optionalText(payload.email, 320, "E-mail"),
        desired_team: optionalText(payload.desiredTeam, 120, "Clube desejado"),
        notes: optionalText(payload.notes, 1000, "Observações"),
        status: "pending",
      }).select("id").single();
    case "waitlist.status":
      if (!["approved", "rejected"].includes(payload.status)) throw new Error("Status inválido.");
      return serviceClient.from("waitlist").update({ status: payload.status })
        .eq("id", uuid(payload.id, "Entrada")).select("id, status").single();
    case "sponsorship.create": {
      const value = Number(payload.value);
      const duration = payload.durationSeasons == null ? null : Number(payload.durationSeasons);
      if (!Number.isFinite(value) || value < 0) throw new Error("Valor inválido.");
      if (duration != null && (!Number.isInteger(duration) || duration < 1 || duration > 100)) {
        throw new Error("Duração inválida.");
      }
      return serviceClient.from("sponsorships").insert({
        sponsor_name: requiredText(payload.sponsorName, 160, "Patrocinador"),
        value,
        duration_seasons: duration,
        team_id: payload.teamId ? uuid(payload.teamId, "Clube") : null,
        active: true,
      }).select("id").single();
    }
    case "sponsorship.active":
      if (typeof payload.active !== "boolean") throw new Error("Estado inválido.");
      return serviceClient.from("sponsorships").update({ active: payload.active })
        .eq("id", uuid(payload.id, "Patrocínio")).select("id, active").single();
    case "trophy.assign":
      return serviceClient.from("team_trophies").insert({
        trophy_id: uuid(payload.trophyId, "Troféu"),
        team_id: uuid(payload.teamId, "Clube"),
        season: optionalText(payload.season, 100, "Temporada"),
      }).select("id").single();
    default:
      throw new Error("Comando administrativo desconhecido.");
  }
}

export async function POST(request) {
  if (READ_ONLY_MODE) return NextResponse.json({ error: "Modo somente leitura" }, { status: 503 });
  const authorization = await requireAdminUser();
  if (authorization.error) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }
  try {
    const body = await request.json();
    if (!body || typeof body.command !== "string" || !body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "Comando inválido." }, { status: 400 });
    }
    const result = await runCommand(body.command, body.payload, authorization.serviceClient, authorization.user.id);
    if (result.error) {
      const status = result.error.code === "23505" ? 409 : result.error.code === "PGRST116" ? 404 : 400;
      return NextResponse.json({ error: "Não foi possível concluir o comando." }, { status });
    }
    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Comando inválido." }, { status: 400 });
  }
}
