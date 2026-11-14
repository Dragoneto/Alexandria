import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { PopupProgresso } from '@/components/popup-progresso';
import { ProgressoDoLivro } from '@/components/progresso-do-livro';
import { SkeletonLibrary } from '@/components/skeletons';
import { DisabledOpacity, TouchMin } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFoco } from '@/hooks/use-foco';
import { useTheme } from '@/hooks/use-theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { ApiError } from '@/services/api';
import {
  atualizarItemBiblioteca,
  filtrarBiblioteca,
  listarBiblioteca,
  removerDaBiblioteca,
  type BibliotecaItem,
  type StatusLeitura,
} from '@/services/biblioteca';

const STATUS_LEITURA: Record<string, string> = {
  QUERO_LER: 'Quero ler',
  LENDO: 'Lendo',
  LIDO: 'Lido',
  ABANDONADO: 'Abandonado',
};

type FiltroStatus = StatusLeitura | 'TODOS';
type EstadoBiblioteca = 'loading' | 'success' | 'empty' | 'error';

const FILTERS: { label: string; value: FiltroStatus }[] = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Quero ler', value: 'QUERO_LER' },
  { label: 'Lendo', value: 'LENDO' },
  { label: 'Lido', value: 'LIDO' },
  { label: 'Abandonado', value: 'ABANDONADO' },
];

export default function Biblioteca() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<BibliotecaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [estado, setEstado] = useState<EstadoBiblioteca>('loading');
  const [filter, setFilter] = useState<FiltroStatus>('TODOS');
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);
  const [busca, setBusca] = useState('');
  const { focado: buscaFocada, propsDeFoco } = useFoco();
  const [statusModalItemId, setStatusModalItemId] = useState<number | null>(null);
  // Tracker: pop-up de páginas aberto para este item (depois de virar "Lendo" ou pelo botão).
  const [progressoItemId, setProgressoItemId] = useState<number | null>(null);
  const [salvandoProgresso, setSalvandoProgresso] = useState(false);
  const [erroProgresso, setErroProgresso] = useState('');
  const [savingFavoriteId, setSavingFavoriteId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  // Livro com a confirmação de remoção aberta no próprio card (o mesmo padrão da tela do livro).
  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<number | null>(null);

  const pendingStatus = useRef(new Set<number>());
  const [savingStatusIds, setSavingStatusIds] = useState<number[]>([]);
  const [aviso, setAviso] = useState('');
  const savingStatus =
    statusModalItemId !== null && savingStatusIds.includes(statusModalItemId)
      ? (items.find((item) => item.id === statusModalItemId)?.statusLeitura ?? null)
      : null;
  const showLoading = useLoadingGate(loading);

  // Recarrega toda vez que a aba ganha foco (ex.: depois de adicionar um livro)
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      listarBiblioteca(controller.signal)
        .then((itens) => {
          setItems(itens);
          setErro('');
          setEstado(itens.length ? 'success' : 'empty');
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setEstado('error');
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar sua biblioteca.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, []),
  );

  const filteredItems = useMemo(
    () =>
      filtrarBiblioteca(items, {
        status: filter === 'TODOS' ? null : filter,
        somenteFavoritos,
        busca,
      }),
    [filter, somenteFavoritos, busca, items],
  );

  const buscaAtiva = busca.trim().length > 0;
  const outrosFiltrosAtivos = filter !== 'TODOS' || somenteFavoritos;

  let emptyMessage = 'Escolha outro filtro para ver os demais livros.';
  if (items.length === 0) {
    emptyMessage = 'Adicione livros pela tela Explorar para preencher sua biblioteca.';
  } else if (buscaAtiva) {
    emptyMessage = outrosFiltrosAtivos
      ? 'Nenhum livro combina com a busca e os filtros escolhidos.'
      : 'Nenhum livro da sua biblioteca combina com essa busca.';
  } else if (somenteFavoritos) {
    emptyMessage = 'Toque em Favoritar num livro para ele aparecer aqui, ou troque o filtro.';
  }

  const limparBuscaEFiltros = () => {
    setBusca('');
    setFilter('TODOS');
    setSomenteFavoritos(false);
  };

  const abrirLivro = (livroId: string) => {
    router.push({ pathname: '/livro/[id]', params: { id: livroId } });
  };

  // Quantos livros há em cada filtro; o número aparece no próprio chip, como no Skoob.
  const counters = useMemo(() => {
    const contagem: Record<FiltroStatus, number> = {
      TODOS: items.length,
      QUERO_LER: 0,
      LENDO: 0,
      LIDO: 0,
      ABANDONADO: 0,
    };
    for (const item of items) contagem[item.statusLeitura] += 1;
    return contagem;
  }, [items]);

  const avisar = (texto: string) => {
    setAviso(texto);
    // No Android e no web, a região ao vivo já anuncia; o iOS precisa do anúncio direto.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(texto);
  };

  // Alert.alert não faz nada no web, então lá o erro aparece no aviso da tela.
  const avisarErro = (titulo: string, mensagem: string) => {
    if (Platform.OS === 'web') avisar(`${titulo}. ${mensagem}`);
    else Alert.alert(titulo, mensagem);
  };

  const handleStatusChange = async (id: number, status: StatusLeitura) => {
    if (pendingStatus.current.has(id)) return;
    const anterior = items.find((item) => item.id === id);
    if (!anterior || anterior.statusLeitura === status) {
      setStatusModalItemId(null);
      return;
    }

    pendingStatus.current.add(id);
    setSavingStatusIds([...pendingStatus.current]);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, statusLeitura: status } : i)));
    try {
      const salvo = await atualizarItemBiblioteca(id, { status });
      // A resposta traz o progresso novo (páginas da Open Library, dia de leitura).
      if (salvo?.id === id) setItems((prev) => prev.map((i) => (i.id === id ? salvo : i)));
      avisar(`Status alterado para ${STATUS_LEITURA[status]}`);
      // Espera o seletor de status fechar: dois Modals ao mesmo tempo travam no iOS.
      if (status === 'LENDO') setTimeout(() => abrirProgresso(id), 350);
    } catch (error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, statusLeitura: anterior.statusLeitura } : item,
        ),
      );
      avisarErro(
        'Não foi possível alterar o status',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      pendingStatus.current.delete(id);
      setSavingStatusIds([...pendingStatus.current]);
      setStatusModalItemId(null);
    }
  };

  const handleFavorite = async (item: BibliotecaItem) => {
    if (savingFavoriteId !== null) return;
    const favorito = !item.favorito;
    setSavingFavoriteId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorito } : i)));
    try {
      await atualizarItemBiblioteca(item.id, { favorito });
      avisar(favorito ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    } catch (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, favorito: item.favorito } : i)),
      );
      avisarErro(
        'Não foi possível alterar o favorito',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      setSavingFavoriteId(null);
    }
  };

  const abrirProgresso = (id: number) => {
    setErroProgresso('');
    setProgressoItemId(id);
  };

  const salvarProgresso = async (paginaAtual: number, paginasTotal?: number) => {
    const id = progressoItemId;
    if (id === null || salvandoProgresso) return;
    setSalvandoProgresso(true);
    setErroProgresso('');
    try {
      const salvo = await atualizarItemBiblioteca(id, { paginaAtual, paginasTotal });
      setItems((prev) => prev.map((i) => (i.id === id ? salvo : i)));
      setProgressoItemId(null);
      avisar('Progresso salvo');
    } catch (error) {
      setErroProgresso(error instanceof ApiError ? error.message : 'Tente de novo em instantes.');
    } finally {
      setSalvandoProgresso(false);
    }
  };

  const itemDoProgresso = items.find((item) => item.id === progressoItemId);

  const remover = async (id: number) => {
    if (removingId !== null) return;
    setRemovingId(id);
    try {
      await removerDaBiblioteca(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (items.length === 1) setEstado('empty');
      avisar('Livro removido da biblioteca');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (items.length === 1) setEstado('empty');
        avisar('Livro removido da biblioteca');
        return;
      }
      avisarErro(
        'Não foi possível remover',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemove = (id: number) => setConfirmandoRemocaoId(id);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* HEADER */}
            <ThemedText themeColor="accent" style={styles.eyebrow}>
              Biblioteca
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Sua estante de leitura
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Organize livros salvos, acompanhe status e marque favoritos.
            </ThemedText>

            <View style={styles.searchContainer}>
              <TextInput
                accessibilityLabel="Buscar na biblioteca por título ou autor"
                style={[
                  styles.searchInput,
                  {
                    borderColor: buscaFocada ? theme.accent : theme.border,
                    color: theme.text,
                    paddingRight: busca ? 40 : 14,
                  },
                ]}
                placeholder="Buscar por título ou autor"
                placeholderTextColor={theme.textMuted}
                value={busca}
                onChangeText={setBusca}
                {...propsDeFoco}
                returnKeyType="search"
                autoCorrect={false}
              />
              {!!busca && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                  onPress={() => setBusca('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.clearSearchButton}>
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                    size={18}
                    tintColor={theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* FILTERS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Filtrar livros por status"
                style={styles.filtersRow}>
                {FILTERS.map((option) => {
                  const active = filter === option.value;
                  // Antes de a lista chegar não há contagem: um "0" ali diria que a estante está vazia.
                  const contagem = estado === 'success' ? counters[option.value] : null;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        contagem === null
                          ? `Filtrar por ${option.label}`
                          : `Filtrar por ${option.label}, ${contagem} ${contagem === 1 ? 'livro' : 'livros'}`
                      }
                      aria-checked={active}
                      onPress={() => setFilter(option.value)}
                      style={[
                        styles.filterChip,
                        { borderColor: active ? theme.accent : theme.border },
                      ]}>
                      {active && (
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={14}
                          tintColor={theme.accent}
                        />
                      )}
                      <ThemedText
                        themeColor={active ? 'accent' : 'textSecondary'}
                        style={styles.filterChipText}>
                        {option.label}
                        {contagem !== null && (
                          <ThemedText themeColor="textSecondary" style={styles.filterChipCount}>
                            {`  ${contagem}`}
                          </ThemedText>
                        )}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setSomenteFavoritos((atual) => !atual)}
                // "togglebutton" sai na web como um papel ARIA que não existe; botão com aria-pressed é o padrão
                accessibilityRole="button"
                accessibilityState={{ selected: somenteFavoritos }}
                aria-pressed={somenteFavoritos}
                accessibilityLabel="Mostrar só favoritos"
                style={[
                  styles.filterChip,
                  { borderColor: somenteFavoritos ? theme.accent : theme.border },
                ]}>
                <SymbolView
                  name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }}
                  size={14}
                  tintColor={somenteFavoritos ? theme.accent : theme.textSecondary}
                />
                <ThemedText
                  themeColor={somenteFavoritos ? 'accent' : 'textSecondary'}
                  style={styles.filterChipText}>
                  Favoritos
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>

            {/* Sempre montado: a região ao vivo pode não anunciar um elemento recém-criado. */}
            <ThemedText
              accessibilityLiveRegion="polite"
              themeColor="textSecondary"
              style={styles.aviso}>
              {aviso}
            </ThemedText>

            {/* LOADING / ERRO / VAZIO / GRID */}
            {estado === 'loading' ? (
              showLoading ? (
                <ThemedView accessibilityLiveRegion="polite">
                  <SkeletonLibrary />
                </ThemedView>
              ) : null
            ) : estado === 'error' ? (
              <ErrorState
                message={erro}
                onRetry={() => {
                  setLoading(true);
                  setEstado('loading');
                  setErro('');
                  listarBiblioteca()
                    .then((itens) => {
                      setItems(itens);
                      setEstado(itens.length ? 'success' : 'empty');
                    })
                    .catch((failure) => {
                      setEstado('error');
                      setErro(
                        failure instanceof ApiError
                          ? failure.message
                          : 'Não foi possível carregar sua biblioteca.',
                      );
                    })
                    .finally(() => setLoading(false));
                }}
              />
            ) : estado === 'empty' ? (
              <EmptyState
                compact
                title="Sua biblioteca está vazia"
                message="Salve livros no Explorar para organizar suas leituras e acompanhar seu progresso."
                primaryAction={{
                  label: 'Explorar livros',
                  onPress: () => router.push('/explore'),
                }}
              />
            ) : filteredItems.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  {buscaAtiva ? 'Nenhum livro encontrado' : 'Nenhum livro neste filtro'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {emptyMessage}
                </ThemedText>
                {(buscaAtiva || outrosFiltrosAtivos) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={buscaAtiva ? 'Limpar busca e filtros' : 'Limpar filtros'}
                    onPress={limparBuscaEFiltros}
                    style={styles.clearFiltersTarget}>
                    <View style={[styles.clearFiltersButton, { borderColor: theme.accent }]}>
                      <ThemedText themeColor="accent" style={styles.clearFiltersText}>
                        {buscaAtiva ? 'Limpar busca e filtros' : 'Limpar filtros'}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                )}
              </ThemedView>
            ) : (
              <View style={styles.grid}>
                {filteredItems.map((item) => (
                  <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                    <TouchableOpacity
                      onPress={() => abrirLivro(item.livro.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir detalhes de ${item.livro.titulo}`}
                      style={styles.cardOpen}>
                      {item.livro.capa ? (
                        <Image
                          source={{ uri: item.livro.capa }}
                          style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}
                          contentFit="contain"
                          accessibilityLabel={`Capa de ${item.livro.titulo}`}
                        />
                      ) : (
                        <View
                          style={[
                            styles.coverPlaceholder,
                            { backgroundColor: theme.backgroundSelected },
                          ]}>
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.coverPlaceholderText}
                            numberOfLines={4}>
                            {item.livro.titulo}
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.cardHeading}>
                        <ThemedText style={styles.cardTitle} numberOfLines={3}>
                          {item.livro.titulo}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={styles.cardAuthor}
                          numberOfLines={2}>
                          {item.livro.autores.join(', ') || 'Autoria não informada'}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Status de leitura de ${item.livro.titulo}: ${STATUS_LEITURA[item.statusLeitura]}. Alterar`}
                        aria-disabled={savingStatusIds.includes(item.id)}
                        aria-busy={savingStatusIds.includes(item.id)}
                        disabled={savingStatusIds.includes(item.id)}
                        style={[
                          styles.statusButton,
                          { borderColor: theme.border },
                          savingStatusIds.includes(item.id) && { opacity: DisabledOpacity },
                        ]}
                        onPress={() => setStatusModalItemId(item.id)}>
                        <ThemedText themeColor="textSecondary" style={styles.statusButtonText}>
                          {savingStatusIds.includes(item.id)
                            ? 'Salvando…'
                            : STATUS_LEITURA[item.statusLeitura]}
                        </ThemedText>
                      </TouchableOpacity>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`${item.favorito ? 'Favorito' : 'Favoritar'}: ${item.livro.titulo}`}
                          aria-selected={item.favorito}
                          aria-disabled={savingFavoriteId !== null}
                          aria-busy={savingFavoriteId === item.id}
                          accessibilityState={{
                            disabled: savingFavoriteId !== null,
                            busy: savingFavoriteId === item.id,
                          }}
                          disabled={savingFavoriteId !== null}
                          style={[
                            styles.actionButton,
                            { borderColor: theme.accent },
                            savingFavoriteId !== null && { opacity: DisabledOpacity },
                          ]}
                          onPress={() => void handleFavorite(item)}>
                          {savingFavoriteId === item.id ? (
                            <ActivityIndicator
                              color={theme.accent}
                              accessibilityLabel="Salvando favorito"
                            />
                          ) : (
                            <ThemedText themeColor="accent" style={styles.favButtonText}>
                              {item.favorito ? 'Favorito' : 'Favoritar'}
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Remover ${item.livro.titulo} da biblioteca`}
                          disabled={removingId !== null}
                          aria-busy={removingId === item.id}
                          accessibilityState={{
                            disabled: removingId !== null,
                            busy: removingId === item.id,
                          }}
                          style={[
                            styles.actionButton,
                            {
                              borderColor: theme.danger,
                              opacity: removingId !== null ? DisabledOpacity : 1,
                            },
                          ]}
                          onPress={() => handleRemove(item.id)}>
                          {removingId === item.id ? (
                            <ActivityIndicator
                              color={theme.danger}
                              accessibilityLabel="Removendo livro"
                            />
                          ) : (
                            <ThemedText themeColor="danger" style={styles.removeButtonText}>
                              Remover
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      </View>
                      {item.statusLeitura === 'LENDO' && (
                        <View style={styles.progressoLinha}>
                          <ProgressoDoLivro
                            progresso={item.progresso}
                            onAtualizar={() => abrirProgresso(item.id)}
                            compacto
                          />
                        </View>
                      )}
                      {confirmandoRemocaoId === item.id && (
                        <View style={styles.confirmRow}>
                          <ThemedText themeColor="textSecondary" style={styles.confirmText}>
                            Remover da biblioteca?
                          </ThemedText>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Confirmar remoção de ${item.livro.titulo}`}
                            style={[styles.confirmButton, { borderColor: theme.danger }]}
                            onPress={() => {
                              setConfirmandoRemocaoId(null);
                              void remover(item.id);
                            }}>
                            <ThemedText themeColor="danger" style={styles.removeButtonText}>
                              Confirmar
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Cancelar remoção"
                            style={[styles.confirmButton, { borderColor: theme.border }]}
                            onPress={() => setConfirmandoRemocaoId(null)}>
                            <ThemedText themeColor="textSecondary" style={styles.removeButtonText}>
                              Cancelar
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </ThemedView>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* STATUS MODAL */}
      <Modal
        visible={statusModalItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (savingStatus === null) setStatusModalItemId(null);
        }}>
        {/* O fundo fica ao lado das opções: se as envolvesse, o leitor de tela não as alcançaria. */}
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            disabled={savingStatus !== null}
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (savingStatus === null) setStatusModalItemId(null);
            }}
          />
          <ThemedView
            accessibilityRole="radiogroup"
            accessibilityLabel="Status de leitura"
            type="backgroundElement"
            style={styles.modalCard}>
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.modalTitle}>
              Status de leitura
            </ThemedText>
            {Object.entries(STATUS_LEITURA).map(([value, label]) => {
              const atual = items.find((i) => i.id === statusModalItemId)?.statusLeitura === value;
              return (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  aria-checked={atual}
                  accessibilityState={{
                    checked: atual,
                    disabled: savingStatus !== null,
                    busy: savingStatus === value,
                  }}
                  disabled={savingStatus !== null}
                  style={[
                    styles.modalOption,
                    // As outras opções ficam apagadas enquanto uma está sendo salva.
                    savingStatus !== null && savingStatus !== value && { opacity: DisabledOpacity },
                  ]}
                  onPress={() => {
                    if (statusModalItemId !== null) {
                      handleStatusChange(statusModalItemId, value as StatusLeitura);
                    }
                  }}>
                  {savingStatus === value ? (
                    <ActivityIndicator color={theme.accent} accessibilityLabel="Salvando status" />
                  ) : (
                    <View style={styles.modalOptionRow}>
                      <ThemedText themeColor={atual ? 'accent' : 'textSecondary'}>
                        {label}
                      </ThemedText>
                      {atual && (
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={14}
                          tintColor={theme.accent}
                        />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        </View>
      </Modal>

      <PopupProgresso
        visible={progressoItemId !== null && !!itemDoProgresso}
        titulo={itemDoProgresso?.livro.titulo}
        progresso={itemDoProgresso?.progresso}
        salvando={salvandoProgresso}
        erro={erroProgresso}
        onSalvar={(pagina, total) => void salvarProgresso(pagina, total)}
        onFechar={() => setProgressoItemId(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.four,
  },
  title: { marginTop: Spacing.one, fontSize: 30, lineHeight: 34 },
  subtitle: { marginTop: Spacing.two, lineHeight: 22 },
  searchContainer: { marginTop: Spacing.four, justifyContent: 'center' },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    // Sem o contorno do navegador: a borda de foco já é do próprio campo.
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersScroll: { marginTop: Spacing.three, marginBottom: Spacing.three },
  filterChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: Spacing.two,
  },
  filtersRow: { flexDirection: 'row' },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterChipCount: { fontSize: 12, fontWeight: '600' },
  progressoLinha: { width: '100%' },
  aviso: { marginBottom: Spacing.two, fontSize: 14 },
  emptyCard: { borderRadius: 16, padding: Spacing.four, gap: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { lineHeight: 22 },
  // A pílula tem 42 px; a área de toque em volta chega a 44 sem mudar o visual nem a posição.
  clearFiltersTarget: {
    alignSelf: 'flex-start',
    minHeight: TouchMin,
    justifyContent: 'center',
    marginTop: 3,
  },
  clearFiltersButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearFiltersText: { fontSize: 13, fontWeight: '800' },
  grid: { gap: Spacing.three },
  card: { borderRadius: 16, overflow: 'hidden' },
  // Capa ao lado do título: cabem mais livros por tela no celular.
  cardOpen: { flexDirection: 'row' },
  cover: { width: 76, height: 114 },
  coverPlaceholder: {
    width: 76,
    height: 114,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  coverPlaceholderText: { fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  cardHeading: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: 6,
  },
  cardActions: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: 8,
    gap: 8,
  },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  statusButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  statusButtonText: { fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: 4 },
  favButtonText: { fontSize: 13, fontWeight: '800' },
  actionButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  removeButtonText: { fontSize: 13, fontWeight: '800' },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  confirmText: { width: '100%', fontSize: 13 },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  modalTitle: { marginBottom: Spacing.two },
  modalOption: { minHeight: TouchMin, justifyContent: 'center' },
  modalOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
