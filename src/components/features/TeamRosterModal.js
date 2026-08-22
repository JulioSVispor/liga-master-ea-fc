"use client";

import { AppImage } from "@/components/ui/AppImage";

export function TeamRosterModal({ team: viewingTeam, players: viewingPlayers, coach: viewingCoach, loading: viewingLoading, getFormationSlots: getViewingFormationSlots, onClose }) {
  if (!viewingTeam) return null;
  return (
    <>
      {/* Modal de Visualização de Elenco e Formação Tática */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-5xl p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl my-8 flex flex-col gap-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  🛡️ {viewingTeam.name}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {viewingTeam.real_club_name ? `${viewingTeam.real_club_name} • ` : ""}
                  Técnico: <span className="text-emerald-400 font-bold">{viewingCoach ? viewingCoach.display_name : "Sem técnico"}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setViewingTeam(null);
                  setViewingPlayers([]);
                  setViewingCoach(null);
                }}
                className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                ✕ Fechar
              </button>
            </div>

            {viewingLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Coluna 1: Campo Tático (6 cols) */}
                <div className="lg:col-span-6 space-y-4">
                   <div className="flex justify-between items-center">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Esquema Tático ({viewingTeam.formation || "4-3-3"})</h3>
                     <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded font-semibold">Titulares</span>
                   </div>
                   
                   <div className="relative aspect-[4/3] w-full rounded-2xl bg-gradient-to-b from-emerald-800/90 to-emerald-950/95 border border-emerald-500/20 overflow-hidden shadow-2xl">
                     {/* Linhas do Campo */}
                     <div className="absolute inset-0 pointer-events-none">
                       {/* Bordas */}
                       <div className="absolute top-[5%] bottom-[5%] left-[5%] right-[5%] border border-white/10" />
                       {/* Linha do Meio de Campo */}
                       <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-white/15" />
                       {/* Círculo Central */}
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/15 rounded-full" />
                       {/* Ponto Central */}
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/30 rounded-full" />
                       {/* Grande Área Superior (Ataque) */}
                       <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-b border-x border-white/10" />
                       {/* Grande Área Inferior (Goleiro) */}
                       <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-t border-x border-white/10" />
                     </div>

                     {/* Mapeamento de Jogadores no Campo */}
                     {getViewingFormationSlots(viewingTeam, viewingPlayers).map((slot, index) => (
                       <div
                         key={index}
                         className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                         style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                       >
                         {slot.player ? (
                           <div className="flex flex-col items-center animate-fadeIn">
                             <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-[#090d16]/95 border border-white/15 flex items-center justify-center overflow-hidden shadow-lg">
                               {/* Rating Badge */}
                               <span className="absolute top-0.5 left-1 text-[8px] font-black bg-[#060913]/90 rounded px-0.5 leading-none text-[#10b981]">
                                 {slot.player.rating}
                               </span>
                               {/* Position Badge */}
                               <span className="absolute bottom-0.5 right-1 text-[7px] font-bold text-gray-300 bg-[#060913]/90 rounded px-0.5 leading-none uppercase">
                                 {slot.title}
                               </span>
                               {slot.player.face_url ? (
                                 <AppImage src={slot.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                               ) : (
                                 <span className="text-sm">👤</span>
                               )}
                             </div>
                             <span className="text-[9px] font-bold text-white bg-[#090d16]/80 rounded px-1 mt-1 truncate max-w-[65px] text-center">
                               {slot.player.common_name || slot.player.name.split(' ').pop()}
                             </span>
                           </div>
                         ) : (
                           /* Slot Vazio */
                           <div className="flex flex-col items-center">
                             <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-dashed border-white/20 bg-black/30 flex items-center justify-center text-[8px] text-gray-400 font-bold uppercase">
                               {slot.title}
                             </div>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                   
                   {/* Banco de Reservas */}
                   <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Banco de Reservas</h4>
                       <span className="text-[9px] text-gray-500 font-semibold">Suplentes</span>
                     </div>
                     <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/5 border border-white/5 max-h-[140px] overflow-y-auto">
                       {(() => {
                         const slots = getViewingFormationSlots(viewingTeam, viewingPlayers);
                         const startIds = new Set(slots.map(s => s.player?.id).filter(Boolean));
                         const bench = viewingPlayers.filter(p => !startIds.has(p.id));
                         
                         return bench.map(p => (
                           <div key={p.id} className="flex items-center gap-1.5 bg-[#090d16]/60 border border-white/5 rounded-lg p-1 px-2.5 max-w-[140px] truncate" title={`${p.name} (${p.position})`}>
                             <span className="text-[9px] font-bold text-[#10b981] bg-[#10b981]/10 px-1 rounded">{p.rating}</span>
                             <span className="text-[9px] font-semibold text-gray-400 uppercase">{p.position}</span>
                             <span className="text-[10px] font-medium text-white truncate flex-1">{p.common_name || p.name.split(' ').pop()}</span>
                           </div>
                         ));
                       })()}
                       {viewingPlayers.length === 0 && <span className="text-[10px] text-gray-500 italic">Nenhum jogador no elenco</span>}
                     </div>
                   </div>
                 </div>

                {/* Coluna 2: Tabela de Detalhes dos Jogadores (6 cols) */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Elenco Completo ({viewingPlayers.length} jogadores)</h3>
                    <div className="text-[10px] text-gray-400">
                      Média de Over: <span className="text-emerald-400 font-bold">{viewingPlayers.length > 0 ? Math.round(viewingPlayers.reduce((sum, p) => sum + p.rating, 0) / viewingPlayers.length) : 0}</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20 max-h-[510px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-gray-300 border-collapse">
                      <thead>
                        <tr className="text-[9px] font-bold uppercase text-gray-500 border-b border-white/5 bg-white/[0.01]">
                          <th className="py-2.5 px-3">Jogador</th>
                          <th className="py-2.5 px-3 text-center w-16">Posição</th>
                          <th className="py-2.5 px-3 text-center w-16">Rating</th>
                          <th className="py-2.5 px-3 text-right w-24">Valor</th>
                          <th className="py-2.5 px-3 text-right w-24">Salário</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {viewingPlayers.map(p => (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2 px-3 font-semibold text-white">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {p.face_url ? (
                                    <AppImage src={p.face_url} alt="" className="h-full w-full object-cover scale-110" />
                                  ) : (
                                    <span>👤</span>
                                  )}
                                </div>
                                <span className="truncate" title={p.name}>{p.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center text-gray-400 font-bold uppercase">{p.position}</td>
                            <td className="py-2 px-3 text-center font-bold text-[#10b981]">{p.rating}</td>
                            <td className="py-2 px-3 text-right font-medium text-blue-400">R$ {parseFloat(p.value).toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">R$ {p.wage.toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        {viewingPlayers.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gray-500 italic">Nenhum jogador no time</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

