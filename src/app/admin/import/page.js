"use client";

import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

export default function AdminImport() {
  const [file, setFile] = useState(null);
  const [multiplier, setMultiplier] = useState(10);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errorLogs, setErrorLogs] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [teamImporting, setTeamImporting] = useState(false);
  const [teamStatus, setTeamStatus] = useState("");
  const [eaImporting, setEaImporting] = useState(false);
  const [eaProgress, setEaProgress] = useState(0);
  const [eaStatus, setEaStatus] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("");
      setErrorLogs([]);
    }
  };

  const handleTeamImport = async (e) => {
    e.preventDefault();
    if (!teamId.trim()) return;

    setTeamImporting(true);
    setTeamStatus("Consultando SoFIFA e salvando jogadores no banco...");

    try {
      const res = await fetch(`/api/sofifa/sync-team?id=${teamId.trim()}`);
      const data = await res.json();

      if (data.success) {
        setTeamStatus(`Sucesso: ${data.message}`);
        setTeamId("");
      } else {
        setTeamStatus(`Erro: ${data.message || "Falha na sincronização."}`);
      }
    } catch (err) {
      setTeamStatus(`Erro de rede: ${err.message}`);
    } finally {
      setTeamImporting(false);
    }
  };

  const handleEAImport = async () => {
    const confirmImport = window.confirm(
      "Deseja iniciar a importação em lote de toda a base oficial do EA FC? Isso importará mais de 15.000 jogadores em lotes de 100 diretamente da API da EA."
    );
    if (!confirmImport) return;

    setEaImporting(true);
    setEaProgress(0);
    setEaStatus("Iniciando conexão com os servidores da EA Sports...");

    try {
      let offset = 0;
      const limit = 100;
      let totalItems = 15905; // Valor padrão aproximado

      while (offset < totalItems) {
        setEaStatus(`Importando jogadores ${offset} a ${Math.min(offset + limit, totalItems)} de ${totalItems}...`);
        
        const res = await fetch(`/api/ea/import?offset=${offset}&limit=${limit}&multiplier=${multiplier}`);
        
        if (!res.ok) {
          throw new Error(`Falha no lote ${offset}: Status ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.message || `Erro no lote ${offset}`);
        }

        totalItems = data.totalItems || totalItems;
        setEaProgress(Math.round((offset / totalItems) * 100));
        offset += limit;

        // Pequena pausa de 50ms para suavizar a interface no browser
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      setEaProgress(100);
      setEaStatus(`Sucesso: Toda a base oficial do EA FC (${totalItems} jogadores) foi importada e atualizada no banco!`);
    } catch (err) {
      setEaStatus(`Erro durante a importação da EA: ${err.message}`);
    } finally {
      setEaImporting(false);
    }
  };

  const handleImport = () => {
    if (!file) {
      alert("Por favor, selecione um arquivo CSV primeiro.");
      return;
    }

    setParsing(true);
    setProgress(0);
    setStatus("Analisando arquivo CSV...");
    setErrorLogs([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          setStatus("Erro: O arquivo CSV está vazio.");
          setParsing(false);
          return;
        }

        setStatus(`Encontrados ${rows.length} jogadores. Preparando inserção...`);
        
        // Mapear e validar linhas
        const playersToInsert = [];
        const logs = [];

        rows.forEach((row, index) => {
          try {
            const id = parseInt(row.id || row.ID);
            const name = row.name || row.Name || row.common_name;
            const rating = parseInt(row.rating || row.Rating || row.overall || row.Overall);
            const potential = parseInt(row.potential || row.Potential);
            const position = row.position || row.Position || "SUB";
            const wage = parseFloat(row.wage || row.Wage || row.salary || 0);
            
            if (isNaN(id) || !name || isNaN(rating)) {
              logs.push(`Linha ${index + 2}: Dados inválidos (ID, Nome ou Rating ausentes)`);
              return;
            }

            playersToInsert.push({
              id,
              name,
              common_name: row.common_name || name,
              rating,
              potential: isNaN(potential) ? rating : potential,
              position: position.toUpperCase().trim(),
              wage,
              value: wage * multiplier, // Regra solicitada: Preço = Multiplicador * Salário
              nation: row.nation || row.Nation || row.nationality || null,
              age: parseInt(row.age || row.Age) || null,
              face_url: row.face_url || row.photo || row.Photo || null,
              playstyles: row.playstyles ? row.playstyles.split(",").map(p => p.trim()) : [],
              playstyles_plus: row.playstyles_plus ? row.playstyles_plus.split(",").map(p => p.trim()) : [],
            });
          } catch (err) {
            logs.push(`Linha ${index + 2}: Erro de processamento - ${err.message}`);
          }
        });

        if (logs.length > 0) {
          setErrorLogs(logs);
        }

        if (playersToInsert.length === 0) {
          setStatus("Erro: Nenhum jogador válido pôde ser processado.");
          setParsing(false);
          return;
        }

        // Enviar para o Supabase em lotes de 500 para evitar timeout
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(playersToInsert.length / BATCH_SIZE);
        
        try {
          for (let i = 0; i < totalBatches; i++) {
            const start = i * BATCH_SIZE;
            const end = start + BATCH_SIZE;
            const chunk = playersToInsert.slice(start, end);

            setStatus(`Enviando lote ${i + 1} de ${totalBatches}...`);
            
            const { error } = await supabase
              .from("players")
              .upsert(chunk, { onConflict: "id" });

            if (error) {
              throw new Error(`Erro no banco de dados (Lote ${i + 1}): ${error.message}`);
            }

            setProgress(Math.round(((i + 1) / totalBatches) * 100));
          }

          setStatus(`Sucesso! ${playersToInsert.length} jogadores importados/atualizados.`);
          setFile(null);
        } catch (err) {
          setStatus(`Falha na importação: ${err.message}`);
        } finally {
          setParsing(false);
        }
      },
      error: (err) => {
        setStatus(`Erro ao analisar CSV: ${err.message}`);
        setParsing(false);
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Importador de Jogadores (CSV)
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Faça o upload do banco de dados oficial do EA FC 26 / SoFIFA em formato CSV para alimentar a liga.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Upload */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-lg font-bold text-white mb-4">Carregar Base de Dados</h3>

            {/* Drop Zone */}
            <div className="mt-2 flex justify-center rounded-xl border border-dashed border-white/10 px-6 pt-10 pb-10 bg-white/[0.02] hover:bg-white/[0.04] transition-all relative">
              <div className="space-y-1 text-center">
                <span className="text-4xl block mb-2">📄</span>
                <div className="flex text-sm text-gray-400">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md font-semibold text-[#10b981] hover:text-[#059669] focus-within:outline-none"
                  >
                    <span>Selecionar um arquivo CSV</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".csv"
                      disabled={parsing}
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">ou arraste e solte</p>
                </div>
                <p className="text-xs text-gray-500">Apenas arquivos .csv com codificação UTF-8</p>
              </div>
            </div>

            {file && (
              <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  disabled={parsing}
                  className="text-xs font-semibold text-red-400 hover:text-red-300"
                >
                  Remover
                </button>
              </div>
            )}

            {/* Configuração do Multiplicador */}
            <div className="mt-6">
              <label htmlFor="multiplier" className="block text-sm font-semibold text-gray-300">
                Multiplicador de Preço de Compra:
              </label>
              <p className="text-xs text-gray-500 mb-2">
                O valor de compra do jogador será calculado como: <code className="text-gray-300">Salário x Multiplicador</code>.
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="multiplier"
                  type="number"
                  min="1"
                  max="1000"
                  disabled={parsing}
                  value={multiplier}
                  onChange={(e) => setMultiplier(parseInt(e.target.value) || 1)}
                  className="w-24 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-white focus:border-[#10b981] outline-none text-sm"
                />
                <span className="text-sm text-gray-400">
                  ex: Jogador com salário de <strong className="text-white">150</strong> custará{" "}
                  <strong className="text-[#10b981]">{150 * multiplier}</strong> de orçamento.
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="mt-8">
              <button
                onClick={handleImport}
                disabled={!file || parsing}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {parsing ? "Importando..." : "Iniciar Importação"}
              </button>
            </div>
          </div>

          {/* Feedback e Status */}
          {status && (
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
              <h4 className="text-sm font-bold text-white mb-2">Status da Operação</h4>
              <p className="text-sm text-gray-300">{status}</p>

              {parsing && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progresso do Banco</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#10b981] to-[#3b82f6] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Painel de Importação por ID de Time */}
          <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-lg font-bold text-white mb-2">Importar Elenco Completo do SoFIFA</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Você pode importar ou atualizar todos os jogadores de um clube específico informando o ID do time no SoFIFA. 
              <span className="block mt-1.5 text-gray-500 font-medium">
                💡 Como descobrir o ID do time: Vá no site do SoFIFA (<a href="https://sofifa.com" target="_blank" rel="noreferrer" className="text-[#10b981] hover:underline">sofifa.com</a>), busque pelo clube desejado e copie o número que aparece na URL. Exemplo: em <code className="text-gray-400 bg-white/5 px-1 py-0.5 rounded">https://sofifa.com/team/241/real-madrid/</code> o ID é <strong className="text-white">241</strong>.
              </span>
            </p>

            <form onSubmit={handleTeamImport} className="space-y-4">
              <div>
                <label htmlFor="teamId" className="block text-sm font-semibold text-gray-300 mb-2">
                  ID do Time no SoFIFA:
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="teamId"
                    type="text"
                    placeholder="Ex: 241"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    disabled={teamImporting}
                    className="w-full sm:max-w-xs rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white focus:border-[#10b981] outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={teamImporting || !teamId.trim()}
                    className="rounded-xl bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {teamImporting ? "Importando..." : "Importar Elenco"}
                  </button>
                </div>
              </div>
            </form>

            {teamStatus && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-300">
                {teamStatus}
              </div>
            )}
          </div>

          {/* Painel de Importação Oficial da EA */}
          <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-lg font-bold text-white mb-2">Importar Base Oficial EA Sports FC (Automático)</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Carregue toda a base oficial de dados do EA FC 25/26 (cerca de 15.900+ atletas) em lote direto dos servidores da EA.
              <span className="block mt-1.5 text-gray-500 font-medium">
                💡 Nota: Os salários são calculados dinamicamente com base no overall do jogador (Overall 90+ = 500/sem, 85-89 = 350/sem, etc.) para garantir o balanceamento do teto de folha.
              </span>
            </p>

            <div className="space-y-4">
              <button
                onClick={handleEAImport}
                disabled={eaImporting || parsing || teamImporting}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3.5 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {eaImporting ? "Importando base..." : "Importar Base da EA (15k+ Jogadores)"}
              </button>

              {eaStatus && (
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-300">
                  <p className="font-semibold mb-2">{eaStatus}</p>
                  {eaImporting && (
                    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${eaProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informações de Formato e Erros */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-base font-bold text-white mb-3">Estrutura Esperada</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              O arquivo CSV deve conter pelo menos as colunas abaixo com seus cabeçalhos exatos (maiúsculo ou minúsculo):
            </p>
            <ul className="space-y-2.5 text-xs text-gray-300">
              <li>
                <code className="text-[#10b981] font-bold">id</code>: ID numérico do jogador (SoFIFA).
              </li>
              <li>
                <code className="text-[#10b981] font-bold">name</code>: Nome do jogador.
              </li>
              <li>
                <code className="text-[#10b981] font-bold">rating</code>: Classificação geral (Overall).
              </li>
              <li>
                <code className="text-[#10b981] font-bold">potential</code>: Rating potencial do jogador.
              </li>
              <li>
                <code className="text-[#10b981] font-bold">position</code>: Posição (GK, CB, CM, ST, etc.).
              </li>
              <li>
                <code className="text-[#10b981] font-bold">wage</code>: Salário semanal do jogador (ex: 150).
              </li>
              <li>
                <code className="text-gray-400">nation</code> (opcional): Nacionalidade.
              </li>
              <li>
                <code className="text-gray-400">age</code> (opcional): Idade.
              </li>
              <li>
                <code className="text-gray-400">face_url</code> (opcional): Link da imagem de rosto do jogador.
              </li>
            </ul>
          </div>

          {errorLogs.length > 0 && (
            <div className="glass-card p-6 rounded-2xl border border-red-500/10 max-h-80 overflow-y-auto">
              <h3 className="text-base font-bold text-red-400 mb-3">Erros/Avisos na Planilha</h3>
              <ul className="space-y-2 text-xs text-gray-400 font-mono">
                {errorLogs.map((log, i) => (
                  <li key={i} className="border-b border-white/5 pb-1">
                    ⚠️ {log}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
