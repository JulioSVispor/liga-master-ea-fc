import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("id");

  if (!teamId) {
    return NextResponse.json(
      { success: false, message: "ID do time é obrigatório" },
      { status: 400 }
    );
  }

  const apiKey = "ZzRjESa71p3YtsyWxN"; // API Key do usuário para a API SoFIFA
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // 1. Chamar a API oficial do SoFIFA para o Time
    const response = await fetch(`https://api.sofifa.net/team/${teamId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "apikey": apiKey,
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { success: false, message: "Limite de requisições do SoFIFA excedido (máximo 60/min). Tente novamente em 1 minuto." },
          { status: 429 }
        );
      }
      
      // Fallback para desenvolvimento local:
      console.warn(`API do SoFIFA retornou status ${response.status} para o time. Utilizando fallback mock.`);
      
      // Simulamos um time mock com jogadores genéricos para não travar o desenvolvimento
      const mockTeamPlayers = [
        { id: 999001, name: "Jogador Mock A", rating: 82, potential: 85, position: "ST", wage: 120 },
        { id: 999002, name: "Jogador Mock B", rating: 78, potential: 82, position: "CM", wage: 80 },
        { id: 999003, name: "Jogador Mock C", rating: 80, potential: 80, position: "CB", wage: 90 },
      ];
      
      const { error: dbError } = await supabase
        .from("players")
        .upsert(mockTeamPlayers.map(p => ({
          id: p.id,
          name: p.name,
          common_name: p.name,
          rating: p.rating,
          potential: p.potential,
          position: p.position,
          wage: p.wage,
          value: p.wage * 10,
          nation: "Simulado",
          age: 24,
          face_url: `https://cdn.sofifa.net/players/000/000/25_120.png`
        })), { onConflict: "id" });

      if (dbError) {
        throw new Error("Erro de fallback no Supabase: " + dbError.message);
      }

      return NextResponse.json({
        success: true,
        message: `[Fallback] 3 jogadores do time simulado (ID: ${teamId}) cadastrados/sincronizados.`,
        playersCount: 3
      });
    }

    const teamData = await response.json();
    const tData = teamData.data;

    if (!tData) {
      return NextResponse.json(
        { success: false, message: "A API do SoFIFA retornou dados de time vazios ou incompatíveis." },
        { status: 500 }
      );
    }

    // Extrair os jogadores da resposta. Geralmente estão em tData.players ou tData.squad ou tData.squads
    const rawPlayers = tData.players || tData.squad || tData.squads || [];

    if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Time ${tData.name || teamId} encontrado, mas nenhum jogador estava listado no elenco da API.`,
        playersCount: 0
      });
    }

    const positionMapping = {
      0: "GK", 1: "SW", 2: "RWB", 3: "RB", 4: "RCB", 5: "CB", 6: "LCB", 7: "LB", 8: "LWB",
      9: "RDM", 10: "CDM", 11: "LDM", 12: "RM", 13: "RCM", 14: "CM", 15: "LCM", 16: "LM",
      17: "RAM", 18: "CAM", 19: "LAM", 20: "RF", 21: "CF", 22: "LF", 23: "RW", 24: "RS",
      25: "ST", 26: "LS", 27: "LW", 28: "SUB", 29: "RES"
    };

    const playersToUpsert = rawPlayers.map((p) => {
      const pid = String(p.id);
      const positionStr = positionMapping[p.position1] || p.position || "CM";
      
      return {
        id: p.id,
        name: p.commonName || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : p.lastName || p.name || "Jogador"),
        common_name: p.commonName || p.lastName || p.name,
        rating: parseInt(p.overallRating || p.rating || 75),
        potential: parseInt(p.potential || 80),
        position: positionStr.toUpperCase().trim(),
        wage: parseFloat(p.wage || 0),
        value: parseFloat(p.wage || 0) * 10, // Preço padrão = 10 * salário
        nation: p.country || p.nationality || "Desconhecida",
        age: parseInt(p.age || 25),
        face_url: p.face_url || `https://cdn.sofifa.net/players/${pid.substring(0, Math.min(3, pid.length))}/${pid.substring(Math.min(3, pid.length))}/25_120.png`,
        playstyles: p.playStyle || [],
        playstyles_plus: p.playStylePlus || []
      };
    });

    // Salvar todos os jogadores no banco
    const { error: dbError } = await supabase
      .from("players")
      .upsert(playersToUpsert, { onConflict: "id" });

    if (dbError) {
      return NextResponse.json(
        { success: false, message: "Erro ao salvar jogadores do time no Supabase: " + dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Elenco de ${tData.name || "Time"} (${playersToUpsert.length} jogadores) sincronizado com sucesso do SoFIFA!`,
      playersCount: playersToUpsert.length
    });

  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Falha inesperada na sincronização do time: " + err.message },
      { status: 500 }
    );
  }
}
