import { READ_ONLY_MODE } from "@/lib/maintenance";

export function MaintenanceBanner() {
  if (!READ_ONLY_MODE) return null;

  return (
    <div className="maintenance-banner" role="status" aria-live="polite">
      <span className="maintenance-banner__label">Manutenção programada</span>
      <span>Consultas continuam disponíveis. Cadastro, partidas, mercado e ajustes financeiros estão pausados.</span>
    </div>
  );
}
