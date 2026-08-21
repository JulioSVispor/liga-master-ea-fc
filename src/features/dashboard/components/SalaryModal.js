import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function SalaryModal({ isOpen, onClose, player, team, salaryWindowOpen, salaryRatio, onSuccess }) {
  const [newSalary, setNewSalary] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  if (!player || !team) return null;

  const handleSalaryAdjust = async () => {
    const salNum = parseFloat(newSalary);
    if (!salNum || salNum <= 0) {
      setError("Digite um salário válido.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("adjust_player_salary", { 
        p_player_id: player.id, 
        p_team_id: team.id, 
        p_new_wage: salNum 
      });
      if (rpcError) throw rpcError;
      if (data?.success === false) {
        setError(data.message || "Erro ao ajustar salário.");
      } else {
        setSuccess("Salário ajustado com sucesso!");
        if (onSuccess) await onSuccess();
        setTimeout(() => {
          onClose();
          setSuccess("");
          setNewSalary("");
        }, 1500);
      }
    } catch (err) {
      setError("Erro ao ajustar salário: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const calculatedValue = newSalary
    ? (parseFloat(newSalary) * salaryRatio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    : "—";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Ajustar Salário">
      {!salaryWindowOpen && (
        <div className="p-3 rounded-xl bg-amber-900/30 border border-amber-900 text-amber-400 mb-4 flex items-start gap-2">
          <span className="text-sm">🔒</span>
          <div className="text-sm">
            <strong className="block font-bold">Janela Fechada</strong>
            O período para ajustar salários está encerrado.
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[#03050a] border border-gray-800">
        <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
          {player.face_url ? (
            <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
          ) : (
            <span className="text-xl">👤</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-emerald-500">{player.rating}</span>
            <span className="text-sm font-bold text-gray-100">{player.name}</span>
          </div>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{player.position}</span>
        </div>
      </div>
      
      <div className="space-y-3 mb-4">
        <input
          type="number"
          value={newSalary}
          onChange={(e) => setNewSalary(e.target.value)}
          placeholder={salaryWindowOpen ? "Ex: 50000" : "Ajuste desativado"}
          disabled={!salaryWindowOpen || saving}
          className="w-full bg-[#03050a] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />
        <div className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-[#03050a] border border-gray-800">
          <span className="text-xs text-gray-400">Novo Passe Estimado <span className="text-gray-600">(× {salaryRatio})</span></span>
          <span className="text-xs font-semibold text-blue-400">R$ {calculatedValue}</span>
        </div>
      </div>
      
      {error && <p className="text-xs text-red-400 mb-4 bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">⚠️ {error}</p>}
      {success && <p className="text-xs text-emerald-400 mb-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg px-3 py-2">✅ {success}</p>}
      
      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} className="flex-1">Fechar</Button>
        <Button 
          variant="primary" 
          onClick={handleSalaryAdjust} 
          disabled={saving || !newSalary || !salaryWindowOpen} 
          className="flex-1"
        >
          {saving ? "Ajustando..." : "Ajustar Salário"}
        </Button>
      </div>
    </Modal>
  );
}
