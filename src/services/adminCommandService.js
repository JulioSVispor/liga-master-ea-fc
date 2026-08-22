async function sendAdminCommand(command, payload) {
  const response = await fetch("/api/admin/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result.data;
}

export const adminCommandService = {
  createInvite: (payload) => sendAdminCommand("invite.create", payload),
  removeInvite: (id) => sendAdminCommand("invite.remove", { id }),
  createNews: (payload) => sendAdminCommand("news.create", payload),
  removeNews: (id) => sendAdminCommand("news.remove", { id }),
  createWaitlistEntry: (payload) => sendAdminCommand("waitlist.create", payload),
  setWaitlistStatus: (id, status) => sendAdminCommand("waitlist.status", { id, status }),
  createSponsorship: (payload) => sendAdminCommand("sponsorship.create", payload),
  setSponsorshipActive: (id, active) => sendAdminCommand("sponsorship.active", { id, active }),
  assignTrophy: (payload) => sendAdminCommand("trophy.assign", payload),

  async uploadAsset(formData) {
    const response = await fetch("/api/admin/assets", { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível enviar a imagem.");
    return result.data;
  },
};
