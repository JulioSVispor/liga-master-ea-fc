import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";

export default function PlayerProfileModal({ isOpen, onClose, player, stats, loading }) {
  if (!player) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil do Jogador" className="max-w-2xl">
      <div className="flex items-center gap-6 mb-6 p-4 rounded-xl bg-[#03050a] border border-gray-800">
        <div className="h-20 w-20 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-gray-700">
          {player.face_url ? (
            <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
          ) : (
            <span className="text-3xl">👤</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-gray-100">{player.name}</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-900/30 text-emerald-400 font-bold text-lg border border-emerald-900/50">
              {player.rating}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2 uppercase font-bold tracking-widest flex gap-3">
            <span>{player.position}</span>
            <span>•</span>
            <span>{player.age || "--"} ANOS</span>
            <span>•</span>
            <span>{player.nation || "N/A"}</span>
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-[#03050a]">
          <CardContent className="p-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Salário Semanal</span>
            <p className="text-lg font-bold text-emerald-400">R$ {parseFloat(player.wage || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#03050a]">
          <CardContent className="p-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Passe de Mercado</span>
            <p className="text-lg font-bold text-blue-400">R$ {parseFloat(player.value || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-2">
          <span>📊</span> Histórico na Liga Master
        </h4>
        
        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : stats.length === 0 ? (
          <Card className="bg-[#03050a] border-dashed">
            <CardContent className="py-8 text-center text-gray-500 text-sm">
              Sem estatísticas registradas em campeonatos oficiais nesta liga.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#03050a]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Temporada</th>
                  <th className="py-3 px-4 text-center">⚽ Gols</th>
                  <th className="py-3 px-4 text-center">🎯 Assist</th>
                  <th className="py-3 px-4 text-center">⭐ MOTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {stats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-100">{stat.season_name}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">{stat.goals}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-400">{stat.assists}</td>
                    <td className="py-3 px-4 text-center font-bold text-amber-400">{stat.motm_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
