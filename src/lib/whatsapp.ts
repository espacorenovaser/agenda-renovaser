function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/** Gera link wa.me com mensagem pronta. phone: só dígitos, ex 5547999999999 */
export function formatWhatsAppLink(opts: {
  phone: string;
  title: string;
  when: Date;
  roomLabel: string;
}): string {
  const digits = opts.phone.replace(/\D/g, "");
  const msg =
    `Olá! Sou do Instituto RenovaSer. ` +
    `Lembramos do seu compromisso agendado para ${formatDate(opts.when)} às ${formatTime(opts.when)} ` +
    `(${opts.title}). Local: ${opts.roomLabel}. ` +
    `Qualquer dúvida, estamos à disposição!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
