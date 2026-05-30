/**
 * Formata valor monetário em Reais (pt-BR)
 * @param {number} value - Valor numérico
 * @param {boolean} compact - Se true, usa formato compacto (ex: R$ 50M)
 */
export function formatCurrency(value, compact = false) {
  const num = parseFloat(value || 0);
  if (compact) {
    if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(0)}k`;
  }
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

/**
 * Formata data em pt-BR
 * @param {string|Date} date
 * @param {boolean} withTime - Incluir horário
 */
export function formatDate(date, withTime = false) {
  const d = new Date(date);
  if (withTime) {
    return d.toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR');
}

/**
 * Retorna a cor CSS baseada no rating do jogador
 */
export function getRatingColor(rating) {
  if (rating >= 90) return 'text-amber-400';
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 80) return 'text-blue-400';
  if (rating >= 75) return 'text-gray-200';
  return 'text-gray-400';
}

/**
 * Agrupa jogadores por setor tático
 */
export function groupPlayersByPosition(players) {
  const attackPositions = ['ST', 'CF', 'LF', 'RF', 'LW', 'RW'];
  const midfieldPositions = ['CM', 'CDM', 'CAM', 'LM', 'RM', 'LCM', 'RCM', 'LDM', 'RDM', 'LAM', 'RAM'];
  const defensePositions = ['CB', 'RCB', 'LCB', 'LB', 'RB', 'LWB', 'RWB', 'SW'];

  return {
    goalkeepers: players.filter(p => p.position === 'GK'),
    defenders: players.filter(p => defensePositions.includes(p.position)),
    midfielders: players.filter(p => midfieldPositions.includes(p.position)),
    attackers: players.filter(p => attackPositions.includes(p.position)),
    others: players.filter(p =>
      p.position !== 'GK' &&
      !attackPositions.includes(p.position) &&
      !midfieldPositions.includes(p.position) &&
      !defensePositions.includes(p.position)
    ),
  };
}
