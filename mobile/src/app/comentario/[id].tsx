import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { BotaoVoltar } from '@/components/botao-voltar';
import { ErrorState } from '@/components/error-state';
import { SkeletonList } from '@/components/skeletons';
import { tempoRelativo } from '@/constants/tempo';
import { MaxContentWidth } from '@/constants/theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import {
  buscarContexto,
  validarDestino,
  type ContextoComentario,
} from '@/services/comentario-contexto';
import type { Comentario } from '@/services/comentarios';

export default function ComentarioContextoScreen() {
  const params = useLocalSearchParams<{ id?: string; avaliacaoId?: string; eventoId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [data, setData] = useState<ContextoComentario | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const pendingPage = useRef(false);
  const showLoading = useLoadingGate(loading);

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    let timer: ReturnType<typeof setTimeout> | undefined;
    pendingPage.current = false;
    const load = async () => {
      await Promise.resolve();
      if (request.signal.aborted) return;
      setLoading(true);
      setMore(false);
      setData(null);
      setError('');
      setUnavailable(false);
      try {
        const destino = validarDestino(params.avaliacaoId, params.id, params.eventoId);
        const result = await buscarContexto(destino, request.signal);
        if (request.signal.aborted) return;
        setData(result);
        setHighlight(true);
        timer = setTimeout(() => setHighlight(false), 5000);
      } catch (failure) {
        if (request.signal.aborted) return;
        const gone =
          failure instanceof ApiError && [400, 404, 409, 410].includes(failure.status ?? 0);
        setUnavailable(gone || (failure instanceof ApiError && failure.kind === 'validation'));
        setError(
          gone
            ? 'Este comentário não está mais disponível neste contexto.'
            : failure instanceof Error
              ? failure.message
              : 'Não foi possível abrir o comentário.',
        );
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => {
      request.abort();
      clearTimeout(timer);
    };
  }, [params.id, params.avaliacaoId, params.eventoId, attempt]);

  const loadMore = async () => {
    const request = controller.current;
    if (!data?.proximoCursor || !request || request.signal.aborted || pendingPage.current) return;
    pendingPage.current = true;
    setMore(true);
    setError('');
    try {
      const destino = validarDestino(params.avaliacaoId, params.id, params.eventoId);
      const next = await buscarContexto(destino, request.signal, data.proximoCursor);
      if (request.signal.aborted) return;
      setData((current) =>
        current
          ? {
              ...next,
              comentarios: [
                ...current.comentarios,
                ...next.comentarios.filter(
                  (item) => !current.comentarios.some((old) => old.id === item.id),
                ),
              ],
            }
          : current,
      );
    } catch (failure) {
      if (!request.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Não foi possível carregar mais.');
    } finally {
      if (controller.current === request) {
        pendingPage.current = false;
        setMore(false);
      }
    }
  };

  // Nome de quem escreveu o comentário respondido, em vez do número interno dele.
  const nomeDoPai = (paiId: number) => {
    const todos = data ? [data.alvo, ...data.ancestrais, ...data.comentarios] : [];
    return todos.find((item) => item.id === paiId)?.autor.nome || 'outro leitor';
  };

  const card = (item: Comentario, selected = false) => (
    <View
      key={item.id}
      style={{
        padding: 16,
        gap: 8,
        borderWidth: selected && highlight ? 2 : 1,
        borderColor: selected && highlight ? theme.accent : theme.border,
        borderRadius: 12,
      }}>
      <Text style={{ color: theme.text, fontWeight: 'bold' }}>
        {item.autor.nome || 'Leitor'}
        <Text style={{ color: theme.textSecondary, fontWeight: 'normal', fontSize: 12 }}>
          {`  ·  ${tempoRelativo(item.criadoEm)}`}
        </Text>
      </Text>
      {item.paiId !== null && (
        <Text style={{ color: theme.textSecondary }}>Resposta a {nomeDoPai(item.paiId)}</Text>
      )}
      <Text style={{ color: theme.text }}>
        {item.removido ? 'Comentário removido' : item.texto}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          width: '100%',
          maxWidth: MaxContentWidth,
          alignSelf: 'center',
        }}>
        <BotaoVoltar fallback="/notificacoes" />
        <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 22 }}>
          Comentário na conversa
        </Text>
        {loading && showLoading && <SkeletonList count={2} />}
        {!!error && (
          <ErrorState
            message={error}
            onRetry={unavailable ? undefined : () => setAttempt((v) => v + 1)}
          />
        )}
        {data && (
          <>
            {card(data.alvo, true)}
            {/* Daqui não dá para escrever: a resposta acontece na conversa completa. */}
            <ActionButton
              label="Responder na conversa"
              onPress={() =>
                router.push({
                  pathname: '/avaliacao/[id]',
                  // A conversa já abre respondendo a este comentário.
                  params: { id: String(data.avaliacaoId), responder: String(data.alvo.id) },
                })
              }
            />
            <ActionButton
              label="Ver o livro"
              variant="ghost"
              onPress={() =>
                router.replace({ pathname: '/livro/[id]', params: { id: data.livroId } })
              }
            />
            {!!data.ancestrais.length && (
              <Text style={{ color: theme.textSecondary }}>
                Mensagens anteriores nesta resposta
              </Text>
            )}
            {data.ancestralAnteriorId !== null && (
              <ActionButton
                label="Ver contexto anterior"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/comentario/[id]',
                    params: {
                      id: String(data.ancestralAnteriorId),
                      avaliacaoId: String(data.avaliacaoId),
                    },
                  })
                }
              />
            )}
            {data.ancestrais.map((item) => card(item))}
            {data.comentarios
              .filter((item) => item.id !== data.comentarioId)
              .map((item) => card(item))}
            {data.proximoCursor !== null && (
              <ActionButton label="Ver mais comentários" loading={more} onPress={loadMore} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
