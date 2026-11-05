import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAuth } from '@/services/auth-storage';

const PREFIXO = 'alexandria_rascunho:';
export const VALIDADE_RASCUNHO_MS = 7 * 24 * 60 * 60 * 1000;

export type AlvoRascunho = {
  usuarioId: number;
  avaliacaoId: number;
  paiId?: number | null;
};

function chave({ usuarioId, avaliacaoId, paiId }: AlvoRascunho) {
  return `${PREFIXO}${usuarioId}:${avaliacaoId}:${paiId ?? 'raiz'}`;
}

function textoVigente(bruto: string | null): string | null {
  if (!bruto) return null;
  try {
    const { texto, salvoEm } = JSON.parse(bruto);
    const vigente = typeof salvoEm === 'number' && Date.now() - salvoEm < VALIDADE_RASCUNHO_MS;
    return vigente && typeof texto === 'string' && texto ? texto : null;
  } catch {
    return null;
  }
}

export type RascunhoSalvo = { paiId: number | null; texto: string };

export async function salvarRascunho(alvo: AlvoRascunho, texto: string): Promise<void> {
  if (!texto.trim()) return AsyncStorage.removeItem(chave(alvo));
  if ((await getAuth())?.id !== alvo.usuarioId) return;
  await AsyncStorage.setItem(chave(alvo), JSON.stringify({ texto, salvoEm: Date.now() }));
}

export async function lerRascunho(alvo: AlvoRascunho): Promise<string | null> {
  const bruto = await AsyncStorage.getItem(chave(alvo));
  const texto = textoVigente(bruto);
  if (bruto && !texto) await AsyncStorage.removeItem(chave(alvo));
  return texto;
}

export async function listarRascunhosDaAvaliacao(
  usuarioId: number,
  avaliacaoId: number,
): Promise<RascunhoSalvo[]> {
  const inicio = `${PREFIXO}${usuarioId}:${avaliacaoId}:`;
  const chaves = (await AsyncStorage.getAllKeys()).filter((item) => item.startsWith(inicio));
  return (await AsyncStorage.multiGet(chaves)).flatMap(([item, bruto]) => {
    const texto = textoVigente(bruto);
    const pai = item.slice(inicio.length);
    return texto ? [{ paiId: pai === 'raiz' ? null : Number(pai), texto }] : [];
  });
}

export function descartarRascunho(alvo: AlvoRascunho): Promise<void> {
  return AsyncStorage.removeItem(chave(alvo));
}

export async function limparRascunhos(manterUsuarioId?: number): Promise<void> {
  const chaves = (await AsyncStorage.getAllKeys()).filter((item) => item.startsWith(PREFIXO));
  const daConta = `${PREFIXO}${manterUsuarioId}:`;
  const pares = await AsyncStorage.multiGet(chaves);
  const remover = pares
    .filter(([item, bruto]) => !item.startsWith(daConta) || !textoVigente(bruto))
    .map(([item]) => item);
  if (remover.length) await AsyncStorage.multiRemove(remover);
}
