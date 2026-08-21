import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/supabase/route-auth";

export async function GET(request) {
  const authorization = await requireAdminUser();
  if (authorization.error) {
    return NextResponse.json({ success: false, message: authorization.error }, { status: authorization.status });
  }

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = parseInt(searchParams.get("limit") || "100");
  const multiplier = parseInt(searchParams.get("multiplier") || "10");

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
