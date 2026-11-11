import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { SkeletonList } from '@/components/skeletons';
import {
  Accent,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
} from '@/constants/design-system';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { ApiError } from '@/services/api';
import {
  contarNaoLidas,
  destinoDaNotificacaoRecebida,
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  type Notificacao,
} from '@/services/notificacoes';

function dataCurta(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : 'Data indisponível';
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  const showLoading = useLoadingGate(loading && items.length === 0);

  const load = useCallback(async (refresh = false) => {
    if (lock.current) return;
    lock.current = true;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [page, count] = await Promise.all([
        listarNotificacoes(undefined, request.signal),
        contarNaoLidas(request.signal),
      ]);
      if (request.signal.aborted) return;
      seen.current = new Set(page.notificacoes.map((item) => item.id));
      setItems(page.notificacoes);
      setCursor(page.proximoCursor);
      setUnread(count);
    } catch (failure) {
      if (!request.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : 'Não foi possível carregar as notificações.',
        );
    } finally {
      if (controller.current === request) {
        lock.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        controller.current?.abort();
        lock.current = false;
      };
    }, [load]),
  );

  const loadMore = async () => {
    if (!cursor || lock.current) return;
    lock.current = true;
    setMore(true);
    setError('');
    const request = new AbortController();
    controller.current = request;
    try {
      const page = await listarNotificacoes(cursor, request.signal);
      if (request.signal.aborted) return;
      const unique = page.notificacoes.filter((item) => !seen.current.has(item.id));
      unique.forEach((item) => seen.current.add(item.id));
      setItems((current) => [...current, ...unique]);
      setCursor(page.proximoCursor);
    } catch (failure) {
      if (!request.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Não foi possível carregar mais notificações.',
        );
    } finally {
      if (controller.current === request) {
        lock.current = false;
        setMore(false);
      }
    }
  };

  const open = async (item: Notificacao) => {
    if (busy) return;
    setBusy(true);
    setOpeningId(item.lidaEm === null ? item.id : null);
    setError('');
    try {
      const destination = destinoDaNotificacaoRecebida(item);
      if (item.lidaEm === null) {
        await marcarNotificacaoLida(item.id);
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, lidaEm: new Date().toISOString() } : row,
          ),
        );
        setUnread((count) => Math.max(0, count - 1));
      }
      router.push(destination);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.kind === 'validation'
          ? 'O comentário desta notificação foi removido ou não está mais disponível.'
          : failure instanceof Error
            ? failure.message
            : 'Não foi possível abrir a notificação.',
      );
      if (failure instanceof ApiError && [404, 410].includes(failure.status ?? 0)) {
        setItems((current) =>
          current.map((row) => (row.id === item.id ? { ...row, alvoDisponivel: false } : row)),
        );
      }
    } finally {
      setBusy(false);
      setOpeningId(null);
    }
  };

  const markAll = async () => {
    if (busy || unread === 0) return;
    setBusy(true);
    setError('');
    try {
      await marcarTodasNotificacoesLidas();
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.lidaEm === null ? { ...item, lidaEm: now } : item)),
      );
      setUnread(0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível marcar como lidas.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Notificações
        </Text>
        <Text style={styles.subtitle}>{unread} não lidas</Text>
        <View style={styles.actions}>
          <ActionButton
            label="Atualizar"
            variant="ghost"
            loading={refreshing}
            onPress={() => void load(true)}
          />
          <ActionButton
            label="Marcar todas como lidas"
            variant="ghost"
            disabled={unread === 0}
            loading={busy}
            onPress={markAll}
          />
        </View>
        {!!error && !items.length && !loading && (
          <ErrorState message={error} onRetry={() => void load()} />
        )}
        {loading && items.length === 0 && showLoading ? <SkeletonList count={3} /> : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            compact
            title="Nenhuma notificação ainda"
            message="As notificações aparecem quando alguém comenta ou responde às suas avaliações. Explore livros e publique uma avaliação para iniciar uma conversa."
            primaryAction={{ label: 'Explorar livros', onPress: () => router.push('/explore') }}
          />
        ) : null}
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            disabled={busy || !item.alvoDisponivel}
            accessibilityState={{
              disabled: busy || !item.alvoDisponivel,
              busy: openingId === item.id,
            }}
            accessibilityLabel={`${item.tipo === 'resposta' ? 'Resposta' : 'Comentário'} de ${item.autor.nome}, ${item.lidaEm ? 'lida' : 'não lida'}`}
            onPress={() => void open(item)}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: item.lidaEm ? Ink.ink500 : Mint.mint400,
                backgroundColor: item.lidaEm ? Ink.ink700 : Mint.mint900,
              },
              pressed && styles.pressed,
              !item.alvoDisponivel && styles.disabled,
            ]}>
            <Text style={styles.author}>
              {item.autor.nome || 'Leitor'} ·{' '}
              {item.tipo === 'resposta' ? 'respondeu a uma conversa' : 'comentou em uma avaliação'}
            </Text>
            <Text style={styles.meta}>
              {dataCurta(item.criadoEm)} · {item.lidaEm ? 'Lida' : 'Não lida'}
            </Text>
            {!item.alvoDisponivel && <Text style={styles.meta}>Comentário não disponível</Text>}
            {openingId === item.id && (
              <View style={styles.cardLoading} pointerEvents="none">
                <ActivityIndicator color={Mint.mint400} accessibilityLabel="Abrindo notificação" />
              </View>
            )}
          </Pressable>
        ))}
        {cursor && (
          <ActionButton label="Carregar mais" variant="ghost" loading={more} onPress={loadMore} />
        )}
        {!!error && items.length > 0 && (
          <ErrorState
            title="Não foi possível concluir"
            message={error}
            onRetry={() => void load(true)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Ink.ink900 },
  content: { padding: ScreenInset, paddingBottom: Space.eight, gap: Space.four },
  title: { color: TextColor.primary, fontSize: 28, fontWeight: '800' },
  subtitle: { color: TextColor.secondary, fontSize: 15 },
  actions: { gap: Space.two },
  card: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Space.four,
    paddingRight: 56,
    gap: Space.two,
  },
  cardLoading: {
    position: 'absolute',
    right: Space.four,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  author: { color: TextColor.primary, fontSize: 15, fontWeight: '700' },
  meta: { color: TextColor.secondary, fontSize: 13 },
  empty: { color: TextColor.secondary, textAlign: 'center', padding: Space.six },
  error: { color: Accent.coral },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
