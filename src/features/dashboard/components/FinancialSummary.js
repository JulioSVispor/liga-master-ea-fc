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

      {/* Resumo de receitas/despesas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Receitas Acumuladas</span>
          <p className="text-xl font-black text-emerald-400">
            R$ {totals.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="text-[10px] text-gray-400 mt-2 space-y-1">
            <div className="flex justify-between"><span>Patrocínios:</span><span className="font-semibold text-white">R$ {totals.sponsors.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Bônus/Prêmios:</span><span className="font-semibold text-white">R$ {totals.rewards.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Vendas de Jogadores:</span><span className="font-semibold text-white">R$ {totals.sales.toLocaleString("pt-BR")}</span></div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Despesas Acumuladas</span>
          <p className="text-xl font-black text-red-400">
            R$ {totals.expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="text-[10px] text-gray-400 mt-2 space-y-1">
            <div className="flex justify-between"><span>Folhas Salariais:</span><span className="font-semibold text-white">R$ {totals.salaries.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Compras/Multas Pagas:</span><span className="font-semibold text-white">R$ {totals.signings.toLocaleString("pt-BR")}</span></div>
            <div className="flex justify-between"><span>Multas de Indisciplina:</span><span className="font-semibold text-white">R$ {totals.fines.toLocaleString("pt-BR")}</span></div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Balanço Líquido (Fluxo)</span>
            <p className={`text-2xl font-black ${totals.income - totals.expense >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              R$ {(totals.income - totals.expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-[9px] text-gray-500 mt-2">Saldo do fluxo líquido financeiro da temporada atual.</span>
        </div>
      </div>

      {/* Gráfico comparativo SVG */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Comparativo Receitas vs Despesas</h4>
          <div className="h-44 w-full flex items-end gap-12 justify-center pb-4 border-b border-white/5 relative">
            <div className="absolute inset-x-0 bottom-4 border-b border-white/5"></div>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-white/5"></div>
            <div className="absolute inset-x-0 top-4 border-b border-white/5"></div>
            <div className="flex flex-col items-center gap-2 z-10 w-20">
              <div
                className="w-full bg-[#10b981]/80 hover:bg-[#10b981] rounded-t-lg transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                style={{ height: `${Math.max(10, Math.min(100, (totals.income / Math.max(1, totals.income + totals.expense)) * 140))}px` }}
              ></div>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Receitas</span>
            </div>
            <div className="flex flex-col items-center gap-2 z-10 w-20">
              <div
                className="w-full bg-red-500/80 hover:bg-red-500 rounded-t-lg transition-all duration-700 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                style={{ height: `${Math.max(10, Math.min(100, (totals.expense / Math.max(1, totals.income + totals.expense)) * 140))}px` }}
              ></div>
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Despesas</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 text-center">Visão comparativa simplificada de fluxo</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detalhamento dos Recursos</h4>
          <div className="space-y-3 pt-2">
            {[
              { label: "Folhas de Elenco (Despesa)", value: totals.salaries, total: totals.expense, color: "bg-red-400" },
              { label: "Contratações de Jogadores (Despesa)", value: totals.signings, total: totals.expense, color: "bg-orange-400" },
              { label: "Rendas de Patrocinadores (Receita)", value: totals.sponsors, total: totals.income, color: "bg-emerald-400" },
            ].map(({ label, value, total, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{label}</span>
                  <span>R$ {value.toLocaleString("pt-BR")}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div className={`${color} h-full rounded-full`} style={{ width: `${Math.min(100, (value / Math.max(1, total)) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
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
                  <th className="py-2.5 px-4">Transação / Histórico</th>
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
                        <p className="font-semibold text-white">{tx.player_name || "Transação do Clube"}</p>
                        <p className="text-[10px] text-gray-500">
                          {isIncome ? `Recebido de: ${tx.from_team_name || "Liga"}` : `Pago para: ${tx.to_team_name || "Liga"}`}
                        </p>
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
