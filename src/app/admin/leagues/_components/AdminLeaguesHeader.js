"use client";

export function AdminLeaguesHeader({
  activePageTab,
  alert,
  onCreateCup,
  onCreateLeague,
  onCreateSeason,
  onSelectTab,
}) {
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Configurações da Liga
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie temporadas, divisões, times participantes e tabelas de confrontos.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCreateSeason}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/25 transition-all"
          >
            ➕ Nova Temporada
          </button>
          {activePageTab === "leagues" ? (
            <button
              onClick={onCreateLeague}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 transition-all"
            >
              ➕ Nova Divisão/Liga
            </button>
          ) : (
            <button
              onClick={onCreateCup}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-all"
            >
              🏆 Criar Copa / Playoff
            </button>
          )}
        </div>
      </div>

      {alert && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${
            alert.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          <span>{alert.type === "success" ? "✅" : "⚠️"}</span>
          <span>{alert.message}</span>
        </div>
      )}

      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => onSelectTab("leagues")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activePageTab === "leagues"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🏆 Ligas (Pontos Corridos)
        </button>
        <button
          onClick={() => onSelectTab("cups")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activePageTab === "cups"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚔️ Copas (Playoffs / Mata-Mata)
        </button>
      </div>
    </>
  );
}
