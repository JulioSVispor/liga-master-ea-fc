import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AppImage } from "@/components/ui/AppImage";

export default function AuctionModal({ isOpen, onClose, player, team, onSuccess }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  if (!player || !team) return null;

  const handleSubmitAuction = async () => {
    setSaving(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("player_submit_to_auction", { 
        p_player_id: player.id, 
        p_team_id: team.id 
      });
      
      if (rpcError) throw rpcError;
      
      if (data?.success === false) {
        setError(data.message || "Erro ao enviar para leilão.");
      } else {
        setSuccess("Jogador enviado para leilão com sucesso!");
        if (onSuccess) await onSuccess();
        setTimeout(() => {
          onClose();
          setSuccess("");
        }, 1500);
      }
    } catch (err) {
      setError("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔨 Enviar para Leilão">
      <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-[#03050a] border border-gray-800">
        <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
          {player.face_url ? (
            <AppImage src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
          ) : (
            <span className="text-xl">👤</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-amber-500">{player.rating}</span>
            <span className="text-sm font-bold text-gray-100">{player.name}</span>
          </div>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{player.position}</span>
        </div>
      </div>
      
      <p className="text-sm text-gray-300 mb-4">
        Tem certeza que deseja colocar <strong className="text-white">{player.name}</strong> em leilão?
      </p>
      
      <p className="text-xs text-gray-400 mb-6 p-3 bg-gray-900/30 rounded-lg border border-gray-800">
        ℹ️ O jogador estará pronto para receber lances quando o administrador liberar a temporada de leilões da liga.
      </p>
      
      {error && <p className="text-xs text-red-400 mb-4 bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">⚠️ {error}</p>}
      {success && <p className="text-xs text-emerald-400 mb-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg px-3 py-2">✅ {success}</p>}
      
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button 
          variant="destructive" 
          onClick={handleSubmitAuction} 
          disabled={saving} 
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
        >
          {saving ? "Enviando..." : "SIM, enviar ao Leilão"}
        </Button>
      </div>
    </Modal>
  );
}
