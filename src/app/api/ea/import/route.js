import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/route-auth";
import { READ_ONLY_MODE } from "@/lib/maintenance";

const POSITIONS = new Set(["GK", "CB", "RB", "LB", "RWB", "LWB", "CDM", "CM", "LM", "RM", "CAM", "LW", "RW", "CF", "ST", "SUB"]);

function cleanImportedPlayer(player) {
  const id = Number(player?.id);
  const rating = Number(player?.rating);
  const potential = Number(player?.potential);
  const wage = Number(player?.wage);
  const value = Number(player?.value);
  const age = player?.age == null ? null : Number(player.age);
  const name = typeof player?.name === "string" ? player.name.trim() : "";
  const position = typeof player?.position === "string" ? player.position.trim().toUpperCase() : "";
  if (!Number.isSafeInteger(id) || id <= 0 || !name || name.length > 160
      || !Number.isInteger(rating) || rating < 0 || rating > 99
      || !Number.isInteger(potential) || potential < 0 || potential > 99
      || !Number.isFinite(wage) || wage < 0 || !Number.isFinite(value) || value < 0
      || (age != null && (!Number.isInteger(age) || age < 15 || age > 60))
      || !POSITIONS.has(position)) {
    throw new Error("O lote contém um jogador inválido.");
  }
  return {
    id,
    name,
    common_name: typeof player.common_name === "string" ? player.common_name.trim().slice(0, 160) : name,
    rating,
    potential,
    position,
    wage,
    value,
    nation: typeof player.nation === "string" ? player.nation.trim().slice(0, 120) : null,
    age,
    face_url: typeof player.face_url === "string" ? player.face_url.trim().slice(0, 2048) : null,
    playstyles: Array.isArray(player.playstyles) ? player.playstyles.filter((item) => typeof item === "string").slice(0, 30) : [],
    playstyles_plus: Array.isArray(player.playstyles_plus) ? player.playstyles_plus.filter((item) => typeof item === "string").slice(0, 30) : [],
  };
}

export async function POST(request) {
  if (READ_ONLY_MODE) {
    return NextResponse.json({ success: false, message: "Modo somente leitura" }, { status: 503 });
  }
  const authorization = await requireAdminUser();
  if (authorization.error) {
    return NextResponse.json({ success: false, message: authorization.error }, { status: authorization.status });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body?.players) || body.players.length < 1 || body.players.length > 500) {
      return NextResponse.json({ success: false, message: "Lote inválido." }, { status: 400 });
    }
    const players = body.players.map(cleanImportedPlayer);
    const { error } = await authorization.serviceClient.from("players")
      .upsert(players, { onConflict: "id" });
    if (error) return NextResponse.json({ success: false, message: "Falha ao salvar o lote." }, { status: 400 });
    return NextResponse.json({ success: true, importedCount: players.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || "Lote inválido." }, { status: 400 });
  }
}

export async function GET(request) {
  if (READ_ONLY_MODE) {
    return NextResponse.json({ success: false, message: "Modo somente leitura" }, { status: 503 });
  }
  const authorization = await requireAdminUser();
  if (authorization.error) {
    return NextResponse.json({ success: false, message: authorization.error }, { status: authorization.status });
  }

  const { searchParams } = new URL(request.url);
  const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "100", 10);
  const multiplier = Number.parseInt(searchParams.get("multiplier") || "10", 10);
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100
      || !Number.isInteger(multiplier) || multiplier < 1 || multiplier > 1000) {
    return NextResponse.json({ success: false, message: "Parâmetros inválidos." }, { status: 400 });
  }

  const { serviceClient: supabase } = authorization;

  try {
    // 1. Chamar a API oficial de ratings da EA Sports FC
    const eaUrl = `https://drop-api.ea.com/rating/ea-sports-fc?locale=pt-br&limit=${limit}&gender=0&offset=${offset}`;
    
    const response = await fetch(eaUrl, {
      headers: {
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Origin": "https://www.ea.com",
        "Referer": "https://www.ea.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Erro ao consultar a API da EA: Status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const items = data.items || [];
    const totalItems = data.totalItems || 0;

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum jogador retornado nesta faixa.",
        importedCount: 0,
        totalItems
      });
    }

    // 2. Mapeamento de Posições (Português -> Internacional standard)
    const mapPosition = (shortLabel) => {
      const mapping = {
        "GOL": "GK",
        "ZAG": "CB",
        "LD": "RB",
        "LE": "LB",
        "ADD": "RWB",
        "ADE": "LWB",
        "VOL": "CDM",
        "MC": "CM",
        "ME": "LM",
        "MD": "RM",
        "MEI": "CAM",
        "PE": "LW",
        "PD": "RW",
        "SA": "CF",
        "ATA": "ST"
      };
      return mapping[shortLabel?.toUpperCase()] || shortLabel || "CM";
    };

    // 3. Função para calcular o salário com base no Overall Rating (para caber no Wage Cap de 15k)
    const calculateWage = (rating) => {
      if (rating >= 90) return 500;
      if (rating >= 85) return 350;
      if (rating >= 80) return 200;
      if (rating >= 75) return 100;
      return 50;
    };

    // 4. Formatar os jogadores
    const playersToUpsert = items.map((p) => {
      const rating = parseInt(p.overallRating || 75);
      const wage = calculateWage(rating);
      
      const name = p.commonName || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : p.lastName || p.firstName || "Jogador");
      const birthYear = p.birthdate ? new Date(p.birthdate).getFullYear() : null;
      const age = birthYear ? (new Date().getFullYear() - birthYear) : 25;
      
      const playstyles = p.playerAbilities ? p.playerAbilities.filter(a => a.type?.id === "playStyle").map(a => a.label) : [];
      const playstyles_plus = p.playerAbilities ? p.playerAbilities.filter(a => a.type?.id === "playStylePlus").map(a => a.label) : [];

      return {
        id: p.id,
        name,
        common_name: p.commonName || p.lastName || name,
        rating,
        potential: rating, // A API da EA não tem potencial, assumimos igual ao rating
        position: mapPosition(p.position?.shortLabel),
        wage,
        value: wage * multiplier,
        nation: p.nationality?.label || "Desconhecida",
        age,
        face_url: p.avatarUrl || `https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p${p.id}.png?padding=0.7`,
        playstyles,
        playstyles_plus
      };
    });

    // 5. Enviar em lote para o Supabase
    const { error: dbError } = await supabase
      .from("players")
      .upsert(playersToUpsert, { onConflict: "id" });

    if (dbError) {
      return NextResponse.json(
        { success: false, message: "Erro ao salvar no Supabase: " + dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${playersToUpsert.length} jogadores importados/atualizados com sucesso.`,
      importedCount: playersToUpsert.length,
      totalItems
    });

  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Erro inesperado: " + err.message },
      { status: 500 }
    );
  }
}
