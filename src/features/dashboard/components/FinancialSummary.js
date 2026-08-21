"use client";

/**
 * FinancialSummary
 * Exibe os cards financeiros (orçamento, folha, elenco, rating),
 * gráficos de fluxo de caixa e o extrato de transações do clube.
 */
export default function FinancialSummary({ team, players, financialHistory, financialLoading }) {
  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);
  const avgRating =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
      : 0;

  const calculateFinancialTotals = () => {
    let income = 0, expense = 0;
    let salaries = 0, signings = 0, fines = 0, sales = 0, rewards = 0, sponsors = 0;

    if (team) {
      financialHistory.forEach((tx) => {
        const amount = parseFloat(tx.amount || 0);
        if (tx.from_team_id === team.id) {
          expense += amount;
          if (tx.transfer_type === "salary_charge") salaries += amount;
          else if (tx.transfer_type === "fine") fines += amount;
          else if (["buyout", "immediate_buy", "auction", "trade"].includes(tx.transfer_type)) signings += amount;
        }
        if (tx.to_team_id === team.id) {
          income += amount;
          if (tx.transfer_type === "sponsorship") sponsors += amount;
          else if (tx.transfer_type === "reward") rewards += amount;
          else if (["buyout", "immediate_buy", "auction", "trade"].includes(tx.transfer_type)) sales += amount;
        }
      });
    }
    return { income, expense, salaries, signings, fines, sales, rewards, sponsors };
  };

  const totals = calculateFinancialTotals();

  return (
    <div className="space-y-6">
      {/* Cards financeiros principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Orçamento Disponível</span>
          <p className="text-2xl font-black text-emerald-400">
            R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">Para contratações e lances de leilão</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Folha Salarial</span>
          <p className="text-2xl font-black text-gray-200">R$ {squadWages.toLocaleString("pt-BR")}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Teto máximo: R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Tamanho do Elenco</span>
          <p className="text-2xl font-black text-white">{players.length} / 24</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Jogadores contratados no time</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Rating Médio do Time</span>
          <p className="text-2xl font-black text-[#f59e0b]">⭐ {avgRating}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Força média do time principal</span>
        </div>
      </div>



      {/* Extrato Financeiro */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-4 text-left">
        <h3 className="text-base font-bold text-white">🧾 Extrato Financeiro do Clube</h3>
        {financialLoading ? (
          <div className="py-8 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10b981] border-t-transparent"></div>
          </div>
        ) : financialHistory.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Nenhuma transação financeira registrada para este clube.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Jogador</th>
                  <th className="py-2.5 px-4">Clube</th>
                  <th className="py-2.5 px-4">Treinador</th>
                  <th className="py-2.5 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {financialHistory.map((tx) => {
                  const isIncome = tx.to_team_id === team.id;
                  const typeLabel = {
                    salary_charge: "Folha Salarial",
                    sponsorship: "Patrocínio",
                    reward: "Premiação",
                    fine: "Multa",
                  }[tx.transfer_type] || (isIncome ? "Venda de Jogador" : "Compra de Jogador");

                  const typeColor = {
                    salary_charge: "bg-red-500/10 text-red-400 border-red-500/20",
                    sponsorship: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    reward: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                  }[tx.transfer_type] || (isIncome
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20");

                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-2.5 px-4 text-gray-500">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${typeColor}`}>{typeLabel}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-black text-white">{tx.player_name || "Transação do Clube"}</p>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">{isIncome ? "Recebido de:" : "Pago para:"}</span>
                          <span className="font-bold text-gray-200 capitalize text-sm">
                            {isIncome ? (tx.from_team_name || "Liga") : (tx.to_team_name || "Liga")}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {(isIncome ? tx.from_coach_name : tx.to_coach_name) ? (
                          <span className="text-xs text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded truncate max-w-[120px]">
                            {isIncome ? tx.from_coach_name : tx.to_coach_name}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-extrabold ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                        {isIncome ? "+" : "-"} R$ {parseFloat(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
