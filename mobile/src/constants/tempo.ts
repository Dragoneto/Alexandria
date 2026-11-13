const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Data de publicação curta, como nas redes de leitura: "agora", "há 5 min",
 * "há 3 h", "ontem", "há 4 dias" e, depois de uma semana, a data (12 de out.).
 */
export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const quando = new Date(iso).getTime();
  if (!Number.isFinite(quando)) return '';
  const passou = Math.max(0, agora - quando);
  if (passou < MINUTO) return 'agora';
  if (passou < HORA) return `há ${Math.floor(passou / MINUTO)} min`;
  if (passou < DIA) return `há ${Math.floor(passou / HORA)} h`;
  const dias = Math.floor(passou / DIA);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  const data = new Date(quando);
  const mesmoAno = data.getFullYear() === new Date(agora).getFullYear();
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    ...(mesmoAno ? {} : { year: 'numeric' }),
  });
}
