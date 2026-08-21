import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";

export default function StatsCards({ team, players, settings }) {
  if (!team) return null;

  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);
  const avgRating =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
      : 0;

  // Tooltip UI Simplificado Interno
  const Tooltip = ({ content }) => {
    const [visible, setVisible] = useState(false);
    return (
      <span 
        className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        ℹ️
        {visible && (
          <span className="absolute z-[100] w-56 p-3 text-[10px] font-normal text-gray-200 bg-[#060913] border border-gray-800 rounded-xl shadow-2xl top-6 left-1/2 -translate-x-1/2 leading-relaxed transition-opacity animate-fadeIn normal-case whitespace-normal">
            {content}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
      <Card className="hover:border-emerald-500/30 transition-colors">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Orçamento Disponível
              <Tooltip content="Saldo líquido em caixa do seu clube para contratação de jogadores na Central de Contratações ou lances em leilões." />
            </span>
            <p className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
              R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[9px] text-gray-500 mt-2 block">Saldo para investimentos</span>
        </CardContent>
      </Card>

      <Card className="hover:border-blue-500/30 transition-colors">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Folha Salarial semanal
              <Tooltip content="Soma dos salários de todos os atletas contratados. Não pode exceder o teto do seu clube." />
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-lg sm:text-xl font-black text-white">
                R$ {squadWages.toLocaleString("pt-BR")}
              </p>
              <span className="text-[9px] text-gray-500">/ R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <span className={`text-[9px] mt-2 block font-bold ${squadWages > team.max_wage_cap ? "text-red-400 animate-pulse" : "text-gray-500"}`}>
            {squadWages > team.max_wage_cap ? "⚠️ Limite Excedido!" : "Dentro do limite teto"}
          </span>
        </CardContent>
      </Card>

      <Card className="hover:border-amber-500/30 transition-colors">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Atletas no Elenco
              <Tooltip content="Quantidade total de jogadores contratados. O limite máximo padrão por time é de 24 atletas." />
            </span>
            <p className="text-lg sm:text-xl font-black text-white mt-1">
              {players.length} <span className="text-xs font-bold text-gray-500">/ {settings.max_players_per_team || 24}</span>
            </p>
          </div>
          <span className="text-[9px] text-gray-500 mt-2 block">Tamanho do elenco</span>
        </CardContent>
      </Card>

      <Card className="hover:border-yellow-500/30 transition-colors">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Rating Médio
              <Tooltip content="Nível médio geral (Over) de todos os atletas do seu clube." />
            </span>
            <p className="text-lg sm:text-xl font-black text-[#f59e0b] mt-1">
              ⭐ {avgRating}
            </p>
          </div>
          <span className="text-[9px] text-gray-500 mt-2 block">Força média do elenco</span>
        </CardContent>
      </Card>
    </div>
  );
}
