// Os cenários das conversas, iguais para os dois modos: mesma sequência de chamadas, mesmas asserções.
// Se um modo divergir do outro, o mesmo teste falha só nele. Os ids nunca são fixados, porque não são iguais
// entre os modos: no PostgreSQL uma gravação recusada gasta o número da sequência, e no arquivo o id é reaproveitado.
const assert = require('node:assert/strict');
const { after, afterEach, before, beforeEach, describe, test } = require('node:test');
const { setTimeout: esperar } = require('node:timers/promises');

const avaliacoes = require('../../src/repositories/avaliacaoRepository');
const comentarios = require('../../src/repositories/comentarioRepository');
const { criarFixtures, encontrarInconsistencias, subirApi } = require('./fixtures');

const semDatas = ({ criadoEm: _criadoEm, atualizadoEm: _atualizadoEm, ...resto }) => resto;

function conferirStatus(respostas, permitidos, contexto) {
  for (const { status, corpo } of respostas) {
    assert.ok(permitidos.includes(status), `${contexto}: status ${status} inesperado (${JSON.stringify(corpo)})`);
  }
}

/** Registra os cenários. Em cenariosDoModo entram os poucos testes que só fazem sentido em um dos modos. */
function definirCenarios(ambiente, cenariosDoModo) {
  describe(`Conversas em ${ambiente.nome}`, () => {
    let api;
    let f;
    let informacoes;

    const armazenados = async () => (await ambiente.lerArmazenamento()).comentarios;

    before(async () => {
      informacoes = await ambiente.iniciar();
      api = await subirApi();
      f = criarFixtures(api);
    });

    after(async () => {
      await api?.encerrar();
      await ambiente.encerrar();
    });

    beforeEach(() => ambiente.limpar());

    // Vale para todo cenário: nenhum deixa órfão nem comentário com texto e marcador em desacordo
    afterEach(async () => {
      assert.deepEqual(encontrarInconsistencias(await ambiente.lerArmazenamento()), []);
    });

    test('registra onde a suíte está rodando', (t) => {
      t.diagnostic(`${ambiente.nome}: ${JSON.stringify(informacoes)}`);
    });

    describe('criar, responder, editar e excluir', () => {
      test('cria e responde em vários níveis: a API das duas contas e o armazenamento concordam', async () => {
        const { ana, bia, avaliacao, raiz, resposta, neta } = await f.novaConversa();

        assert.deepEqual(semDatas(raiz), {
          id: raiz.id,
          avaliacaoId: avaliacao.id,
          paiId: null,
          autor: { id: bia.id, nome: 'Bia' },
          texto: 'Comentário raiz da Bia',
          removido: false,
          versao: 1,
          podeEditar: true,
          podeExcluir: true,
        });

        for (const [leitor, proprios] of [
          [ana, [resposta.id]],
          [bia, [raiz.id, neta.id]],
        ]) {
          const { status, corpo } = await f.listar(leitor, avaliacao.id);
          assert.equal(status, 200);
          assert.deepEqual(
            corpo.comentarios.map((c) => [c.id, c.paiId, c.autor.nome, c.texto]),
            [
              [raiz.id, null, 'Bia', 'Comentário raiz da Bia'],
              [resposta.id, raiz.id, 'Ana', 'Resposta da Ana'],
              [neta.id, resposta.id, 'Bia', 'Resposta à resposta'],
            ],
          );
          assert.deepEqual(corpo.comentarios.filter((c) => c.podeEditar).map((c) => c.id), proprios);
          assert.ok(!JSON.stringify(corpo).includes('@alexandria.test'), 'A lista não pode trazer e-mail');
        }

        assert.deepEqual(await armazenados(), [
          { id: raiz.id, avaliacao_id: avaliacao.id, user_id: bia.id, pai_id: null, texto: raiz.texto, removido: false },
          { id: resposta.id, avaliacao_id: avaliacao.id, user_id: ana.id, pai_id: raiz.id, texto: resposta.texto, removido: false },
          { id: neta.id, avaliacao_id: avaliacao.id, user_id: bia.id, pai_id: resposta.id, texto: neta.texto, removido: false },
        ]);
      });

      test('editar muda só o texto e a data de atualização, nunca autor, avaliação, pai ou posição', async () => {
        const { ana, bia, avaliacao, raiz, resposta, neta } = await f.novaConversa();
        await esperar(5); // para a data de atualização ficar visivelmente depois da criação

        const { status, corpo } = await f.editar(ana, resposta.id, {
          texto: '  Resposta   corrigida ',
          paiId: null,
          avaliacaoId: 999,
          usuarioId: bia.id,
        });

        assert.equal(status, 200);
        assert.deepEqual(semDatas(corpo.comentario), {
          ...semDatas(resposta),
          texto: 'Resposta corrigida',
        });
        assert.equal(corpo.comentario.criadoEm, resposta.criadoEm);
        assert.ok(corpo.comentario.atualizadoEm > corpo.comentario.criadoEm);

        const lista = (await f.listar(ana, avaliacao.id)).corpo.comentarios;
        assert.deepEqual(lista.map((c) => c.id), [raiz.id, resposta.id, neta.id]);
        assert.equal((await armazenados()).find((c) => c.id === resposta.id).texto, 'Resposta corrigida');
      });

      test('excluir o pai tira o texto de verdade e preserva os filhos', async () => {
        const { ana, bia, avaliacao, raiz, resposta, neta } = await f.novaConversa();
        const antes = await armazenados();

        const { status, corpo } = await f.excluir(bia, raiz.id);

        assert.equal(status, 200);
        assert.deepEqual(semDatas(corpo.comentario), {
          ...semDatas(raiz),
          texto: null,
          removido: true,
          podeEditar: false,
          podeExcluir: false,
        });
        // Excluir não conta como edição: a data de atualização continua a mesma nos dois modos
        assert.equal(corpo.comentario.atualizadoEm, raiz.atualizadoEm);

        const lista = (await f.listar(ana, avaliacao.id)).corpo.comentarios;
        assert.deepEqual(
          lista.map((c) => [c.id, c.paiId, c.removido, c.texto]),
          [
            [raiz.id, null, true, null],
            [resposta.id, raiz.id, false, 'Resposta da Ana'],
            [neta.id, resposta.id, false, 'Resposta à resposta'],
          ],
        );

        assert.deepEqual(await armazenados(), [
          { ...antes[0], texto: null, removido: true },
          antes[1],
          antes[2],
        ]);
        assert.ok(!(await ambiente.comentariosBrutos()).includes('Comentário raiz da Bia'));
      });

      test('excluir o comentário do meio mantém o pai dele e a resposta abaixo', async () => {
        const { ana, avaliacao, raiz, resposta, neta } = await f.novaConversa();

        assert.equal((await f.excluir(ana, resposta.id)).status, 200);

        const lista = (await f.listar(ana, avaliacao.id)).corpo.comentarios;
        assert.deepEqual(
          lista.map((c) => [c.id, c.paiId, c.removido]),
          [
            [raiz.id, null, false],
            [resposta.id, raiz.id, true],
            [neta.id, resposta.id, false],
          ],
        );
      });

      test('removido não aceita edição, nova exclusão nem resposta; os filhos dele seguem aceitando', async () => {
        const { ana, bia, avaliacao, raiz, resposta } = await f.novaConversa();
        await f.excluir(bia, raiz.id);
        const antes = await armazenados();

        assert.equal((await f.editar(bia, raiz.id, { texto: 'Voltei' })).status, 409);
        assert.equal((await f.excluir(bia, raiz.id)).status, 409);
        assert.equal((await f.comentar(ana, avaliacao.id, 'Resposta ao removido', raiz.id)).status, 409);
        assert.deepEqual(await armazenados(), antes);

        assert.equal((await f.editar(ana, resposta.id, { texto: 'Ainda posso editar' })).status, 200);
        assert.equal((await f.comentar(bia, avaliacao.id, 'Resposta ao filho', resposta.id)).status, 201);
      });

      test('só o dono altera: outra pessoa recebe 403 e nada muda', async () => {
        const { ana, bia, raiz } = await f.novaConversa();
        const antes = await armazenados();

        assert.equal((await f.editar(ana, raiz.id, { texto: 'Invasão' })).status, 403);
        assert.equal((await f.excluir(ana, raiz.id)).status, 403);

        const estranha = await f.novoLeitor('Cris');
        assert.equal((await f.editar(estranha, raiz.id, { texto: 'Invasão' })).status, 403);
        assert.equal((await f.excluir(estranha, raiz.id)).status, 403);

        assert.deepEqual(await armazenados(), antes);
        assert.equal((await f.editar(bia, raiz.id, { texto: 'Meu texto' })).status, 200);
      });

      test('validação e sessão recusam sem gravar nada', async () => {
        const { bia, avaliacao, raiz } = await f.novaConversa();
        const antes = await armazenados();

        for (const texto of [undefined, '   ', '​​', 42, 'a'.repeat(2001)]) {
          const corpo = texto === undefined ? {} : { texto };
          assert.equal((await api.chamar('POST', `/api/avaliacoes/${avaliacao.id}/comentarios`, { leitor: bia, corpo })).status, 400);
          assert.equal((await f.editar(bia, raiz.id, corpo)).status, 400);
        }
        for (const paiId of ['1', 0, 1.5, -1, true]) {
          assert.equal((await f.comentar(bia, avaliacao.id, 'Oi', paiId)).status, 400);
        }
        for (const id of ['abc', '-1', '1.5']) {
          assert.equal((await f.comentar(bia, id, 'Oi')).status, 400);
          assert.equal((await f.editar(bia, id, { texto: 'Oi' })).status, 400);
          assert.equal((await f.excluir(bia, id)).status, 400);
        }
        assert.equal((await f.comentar(bia, 999999, 'Oi')).status, 404);
        assert.equal((await f.editar(bia, 999999, { texto: 'Oi' })).status, 404);
        assert.equal((await f.excluir(bia, 999999)).status, 404);

        const semSessao = { token: 'token-invalido' };
        assert.equal((await f.comentar(semSessao, avaliacao.id, 'Oi')).status, 401);
        assert.equal((await f.editar(semSessao, raiz.id, { texto: 'Oi' })).status, 401);
        assert.equal((await f.excluir(semSessao, raiz.id)).status, 401);
        assert.equal((await f.listar(semSessao, avaliacao.id)).status, 401);

        assert.deepEqual(await armazenados(), antes);
      });

      test('guarda e devolve o mesmo texto nos dois modos, em qualquer alfabeto ou caractere', async () => {
        const ana = await f.novoLeitor('Ana');
        const avaliacao = await f.novaAvaliacao(ana);

        const casos = [
          ['Ação, coração e ñandú', 'Ação, coração e ñandú'],
          ['Família 👩‍👩‍👧‍👦 e polegar 👍🏽', 'Família 👩‍👩‍👧‍👦 e polegar 👍🏽'],
          ['日本語 العربية Ελληνικά', '日本語 العربية Ελληνικά'],
          ['primeira\r\nsegunda', 'primeira\nsegunda'],
          ['é vira um caractere só', 'é vira um caractere só'],
          ['nulo\u0000 no meio', 'nulo no meio'],
          ['surrogate \ud83d sozinho', 'surrogate � sozinho'],
          ["'; DROP TABLE comentarios; --", "'; DROP TABLE comentarios; --"],
          ['$1 %s \\n "aspas" \\', '$1 %s \\n "aspas" \\'],
          ['é'.repeat(2000), 'é'.repeat(2000)],
          ['😀'.repeat(2000), '😀'.repeat(2000)],
        ];

        for (const [enviado, esperado] of casos) {
          const { status, corpo } = await f.comentar(ana, avaliacao.id, enviado);
          assert.equal(status, 201, `Recusou ${JSON.stringify(enviado.slice(0, 30))}`);
          assert.equal(corpo.comentario.texto, esperado);
        }

        const lidos = (await f.listar(ana, avaliacao.id)).corpo.comentarios.map((c) => c.texto);
        assert.deepEqual(lidos, casos.map(([, esperado]) => esperado));
        assert.deepEqual((await armazenados()).map((c) => c.texto), lidos);
      });

      test('reinicializar o armazenamento, como ao subir a API de novo, não perde a conversa', async () => {
        await f.novaConversa();
        const antes = await ambiente.lerArmazenamento();

        await ambiente.inicializarRepositorios();

        assert.deepEqual(await ambiente.lerArmazenamento(), antes);
      });
    });

    describe('pai de outra avaliação e operações simultâneas', () => {
      test('pai de outra avaliação ou inexistente dá 404, pai removido dá 409, e nada é gravado', async () => {
        const { ana, bia, avaliacao, raiz } = await f.novaConversa();
        const outra = await f.novaAvaliacao(bia);
        const deFora = await f.comentado(ana, outra.id, 'Comentário em outra avaliação');
        const removido = await f.comentado(bia, avaliacao.id, 'Será removido');
        await f.excluir(bia, removido.id);
        const antes = await armazenados();

        assert.equal((await f.comentar(bia, avaliacao.id, 'Pai de fora', deFora.id)).status, 404);
        assert.equal((await f.comentar(ana, outra.id, 'Pai de fora', raiz.id)).status, 404);
        assert.equal((await f.comentar(bia, avaliacao.id, 'Pai inexistente', 999999)).status, 404);
        assert.equal((await f.comentar(bia, avaliacao.id, 'Pai removido', removido.id)).status, 409);

        assert.deepEqual(await armazenados(), antes);
      });

      test('comentários simultâneos: nenhum se perde e cada um recebe um id próprio', async () => {
        const { ana, bia, avaliacao, raiz } = await f.novaConversa();
        const antes = (await armazenados()).length;

        const respostas = await Promise.all(
          Array.from({ length: 25 }, (_, i) =>
            f.comentar(i % 2 ? ana : bia, avaliacao.id, `Simultâneo ${i}`, i % 3 ? raiz.id : undefined),
          ),
        );

        conferirStatus(respostas, [201], 'Comentário simultâneo');
        const ids = respostas.map(({ corpo }) => corpo.comentario.id);
        assert.equal(new Set(ids).size, ids.length);

        const gravados = await armazenados();
        assert.equal(gravados.length, antes + ids.length);
        for (let i = 0; i < 25; i += 1) assert.ok(gravados.some((c) => c.texto === `Simultâneo ${i}`));
      });

      test('edições simultâneas em comentários diferentes: nenhuma se perde', async () => {
        const { bia, avaliacao } = await f.novaConversa();
        const criados = [];
        for (let i = 0; i < 10; i += 1) criados.push(await f.comentado(bia, avaliacao.id, `Original ${i}`));

        const respostas = await Promise.all(
          criados.map((c, i) => f.editar(bia, c.id, { texto: `Editado ${i}` })),
        );

        conferirStatus(respostas, [200], 'Edição simultânea');
        const gravados = await armazenados();
        criados.forEach((c, i) => {
          assert.equal(gravados.find((g) => g.id === c.id).texto, `Editado ${i}`);
        });
      });

      test('exclusão dupla simultânea: uma vence com 200 e a outra recebe 409', async () => {
        const { bia, raiz } = await f.novaConversa();

        const status = (await Promise.all([f.excluir(bia, raiz.id), f.excluir(bia, raiz.id)])).map((r) => r.status);

        assert.deepEqual(status.sort(), [200, 409]);
      });

      test('edição e exclusão simultâneas do mesmo comentário: sempre termina removido e sem texto', async () => {
        const { bia, raiz, resposta } = await f.novaConversa();

        const [edicao, exclusao] = await Promise.all([
          f.editar(bia, raiz.id, { texto: 'Editando enquanto apaga' }),
          f.excluir(bia, raiz.id),
        ]);

        conferirStatus([edicao], [200, 409], 'Edição');
        assert.equal(exclusao.status, 200);
        const gravados = await armazenados();
        assert.deepEqual(
          [gravados.find((c) => c.id === raiz.id).texto, gravados.find((c) => c.id === raiz.id).removido],
          [null, true],
        );
        assert.ok(gravados.some((c) => c.id === resposta.id));
        assert.ok(!(await ambiente.comentariosBrutos()).includes('Editando enquanto apaga'));
      });

      test('comentário removido entre a checagem e a gravação da edição: 409 sem recriar o texto', async (t) => {
        const { bia, raiz } = await f.novaConversa();
        const { remove: apagar, update: gravar } = comentarios;
        t.mock.method(comentarios, 'update', async (...argumentos) => {
          await apagar(raiz.id, bia.id); // removido em outra aba antes de gravar
          return gravar(...argumentos);
        });

        assert.equal((await f.editar(bia, raiz.id, { texto: 'Chegou tarde' })).status, 409);

        const gravado = (await armazenados()).find((c) => c.id === raiz.id);
        assert.deepEqual([gravado.texto, gravado.removido], [null, true]);
      });

      test('pai removido entre a checagem e a gravação da resposta: o armazenamento continua consistente', async (t) => {
        const { ana, bia, avaliacao, raiz, resposta } = await f.novaConversa();
        const { create: gravar, remove: apagar } = comentarios;
        t.mock.method(comentarios, 'create', async (dados) => {
          await apagar(raiz.id, bia.id);
          return gravar(dados);
        });

        const { status } = await f.comentar(ana, avaliacao.id, 'Resposta na hora da exclusão', raiz.id);

        conferirStatus([{ status }], [201, 409], 'Resposta');
        const gravados = await armazenados();
        assert.equal(gravados.find((c) => c.id === raiz.id).removido, true);
        assert.ok(gravados.some((c) => c.id === resposta.id));
      });
    });

    describe('exclusão concorrente da avaliação', () => {
      test('avaliação apagada antes de gravar o comentário: 404 e nada fica para trás', async (t) => {
        const { ana, bia, avaliacao } = await f.novaConversa();
        const gravar = comentarios.create;
        t.mock.method(comentarios, 'create', async (dados) => {
          await avaliacoes.remove(avaliacao.id, ana.id);
          return gravar(dados);
        });

        assert.equal((await f.comentar(bia, avaliacao.id, 'Chegou tarde')).status, 404);
        assert.deepEqual(await armazenados(), []);
      });

      test('avaliação apagada antes de gravar a resposta: 404, sem resposta órfã do pai que sumiu', async (t) => {
        const { ana, bia, avaliacao, neta } = await f.novaConversa();
        const gravar = comentarios.create;
        t.mock.method(comentarios, 'create', async (dados) => {
          await avaliacoes.remove(avaliacao.id, ana.id);
          return gravar(dados);
        });

        assert.equal((await f.comentar(bia, avaliacao.id, 'Chegou tarde', neta.id)).status, 404);
        assert.deepEqual(await armazenados(), []);
      });

      test('avaliação apagada antes de gravar a edição ou a exclusão do comentário: 404 sem recriar', async (t) => {
        const { ana, bia, avaliacao, raiz } = await f.novaConversa();
        const { remove: apagar, update: gravar } = comentarios;
        t.mock.method(comentarios, 'update', async (...argumentos) => {
          await avaliacoes.remove(avaliacao.id, ana.id);
          return gravar(...argumentos);
        });
        assert.equal((await f.editar(bia, raiz.id, { texto: 'Chegou tarde' })).status, 404);
        assert.deepEqual(await armazenados(), []);

        // Mesma corrida na exclusão, agora com uma conversa nova
        const segunda = await f.novaConversa();
        t.mock.method(comentarios, 'remove', async (...argumentos) => {
          await avaliacoes.remove(segunda.avaliacao.id, segunda.ana.id);
          return apagar(...argumentos);
        });
        assert.equal((await f.excluir(segunda.bia, segunda.raiz.id)).status, 404);
        assert.deepEqual(await armazenados(), []);
      });

      test(
        'avaliação apagada e outra criada antes de gravar: o comentário não cai na avaliação nova',
        // Divergência conhecida: o arquivo reaproveita o id da avaliação apagada, o PostgreSQL nunca reaproveita
        { todo: ambiente.modo === 'local-file' && 'limitação do JSON local, ver docs/testes-persistencia.md' },
        async (t) => {
          const { ana, bia, avaliacao } = await f.novaConversa();
          const gravar = comentarios.create;
          let nova;
          t.mock.method(comentarios, 'create', async (dados) => {
            await avaliacoes.remove(avaliacao.id, ana.id);
            nova = await f.novaAvaliacao(ana);
            return gravar(dados);
          });

          assert.equal((await f.comentar(bia, avaliacao.id, 'Era para a avaliação apagada')).status, 404);
          assert.deepEqual((await armazenados()).filter((c) => c.avaliacao_id === nova.id), []);
        },
      );

      test('comentar, responder, editar e excluir em paralelo com a exclusão da avaliação', async () => {
        for (let rodada = 0; rodada < 5; rodada += 1) {
          const { ana, bia, avaliacao, raiz, neta } = await f.novaConversa();
          const vizinha = await f.novaAvaliacao(bia);
          const permanece = await f.comentado(ana, vizinha.id, 'Em outra avaliação, não pode sumir');

          const novos = Array.from({ length: 10 }, (_, i) => f.comentar(ana, avaliacao.id, `Novo ${i}`));
          const respostas = Array.from({ length: 5 }, (_, i) => f.comentar(ana, avaliacao.id, `Resposta ${i}`, raiz.id));
          const edicao = f.editar(bia, raiz.id, { texto: 'Editado na corrida' });
          const exclusao = f.excluir(bia, neta.id);
          const exclusaoDaAvaliacao = f.excluirAvaliacao(ana, avaliacao.id);

          conferirStatus(await Promise.all(novos), [201, 404], 'Comentário');
          conferirStatus(await Promise.all(respostas), [201, 404], 'Resposta');
          conferirStatus([await edicao], [200, 404], 'Edição');
          conferirStatus([await exclusao], [200, 404], 'Exclusão do comentário');
          assert.equal((await exclusaoDaAvaliacao).status, 200);

          assert.equal((await f.listar(bia, avaliacao.id)).status, 404);
          const gravados = await armazenados();
          assert.deepEqual(gravados.filter((c) => c.avaliacao_id === avaliacao.id), []);
          assert.ok(gravados.some((c) => c.id === permanece.id));
        }
      });

      test('excluir a avaliação leva a árvore inteira, removidos inclusive, e não toca nas vizinhas', async () => {
        const { ana, bia, avaliacao, resposta } = await f.novaConversa();
        const vizinha = await f.novaAvaliacao(bia);
        const permanece = await f.comentado(ana, vizinha.id, 'Em outra avaliação');
        await f.excluir(ana, resposta.id);

        assert.equal((await f.excluirAvaliacao(ana, avaliacao.id)).status, 200);

        assert.deepEqual((await armazenados()).map((c) => c.id), [permanece.id]);
        assert.equal((await f.listar(bia, avaliacao.id)).status, 404);
        assert.ok(!(await ambiente.lerArmazenamento()).avaliacoes.some((a) => a.id === avaliacao.id));

        // No arquivo a próxima avaliação pode herdar o id da apagada: ela precisa começar vazia nos dois modos
        const nova = await f.novaAvaliacao(ana);
        assert.deepEqual((await f.listar(bia, nova.id)).corpo.comentarios, []);
      });

      test('só o dono exclui a avaliação: outra pessoa recebe 403 e a conversa fica', async () => {
        const { bia, avaliacao } = await f.novaConversa();
        const antes = await ambiente.lerArmazenamento();

        assert.equal((await f.excluirAvaliacao(bia, avaliacao.id)).status, 403);

        assert.deepEqual(await ambiente.lerArmazenamento(), antes);
      });
    });

    describe('ordem e paginação', () => {
      test('comentários: a ordem de criação não muda com leituras repetidas, edições, exclusões ou respostas', async () => {
        const { ana, bia, avaliacao, raiz, resposta, neta } = await f.novaConversa();
        const ultimo = await f.comentado(ana, avaliacao.id, 'Último comentário raiz');

        await f.editar(bia, raiz.id, { texto: 'Raiz editada' });
        await f.excluir(ana, resposta.id);

        const esperada = [raiz.id, resposta.id, neta.id, ultimo.id];
        for (let leitura = 0; leitura < 5; leitura += 1) {
          const lista = (await f.listar(bia, avaliacao.id)).corpo.comentarios;
          assert.deepEqual(lista.map((c) => c.id), esperada);
        }

        // Resposta ao comentário mais antigo entra no fim: a ordem é de criação, não de árvore
        const tardia = await f.comentado(ana, avaliacao.id, 'Resposta tardia', raiz.id);
        const lista = (await f.listar(bia, avaliacao.id)).corpo.comentarios;
        assert.deepEqual(lista.map((c) => c.id), [...esperada, tardia.id]);
      });

      test('avaliações do livro: páginas sem repetição nem falta, a própria primeiro e empate desfeito pelo id', async () => {
        const LIVRO = 'OL999W';
        const eu = await f.novoLeitor('Eu');
        const minha = await f.novaAvaliacao(eu, { livroId: LIVRO, nota: 1 });
        const outras = [];
        for (let i = 0; i < 6; i += 1) {
          outras.push(await f.novaAvaliacao(await f.novoLeitor(`Pessoa${i}`), { livroId: LIVRO, nota: 5 }));
        }
        const [a, b, c, d, e, g] = outras;

        // a e g são a mais nova e a mais antiga; b, c, d e e empatam na mesma data, mesmo gravadas em outra ordem
        const datas = [
          [minha, '2020-01-01T00:00:00.000Z'],
          [a, '2024-03-03T12:00:00.000Z'],
          [b, '2024-02-02T12:00:00.000Z'],
          [c, '2024-02-02T12:00:00.000Z'],
          [d, '2024-02-02T12:00:00.000Z'],
          [e, '2024-02-02T12:00:00.000Z'],
          [g, '2023-01-01T12:00:00.000Z'],
        ];
        for (const [avaliacao, data] of datas) await ambiente.definirCriacaoDaAvaliacao(avaliacao.id, data);

        const esperada = [minha, a, e, d, c, b, g].map((avaliacao) => avaliacao.id);
        const pagina = (page, limit, leitor = eu) =>
          api.chamar('GET', `/api/avaliacoes/livro/${LIVRO}?page=${page}&limit=${limit}`, { leitor });

        const lidas = [];
        for (const page of [1, 2, 3]) {
          const { status, corpo } = await pagina(page, 3);
          assert.equal(status, 200);
          assert.equal(corpo.total, 7);
          assert.equal(corpo.media, 4.4);
          assert.equal(corpo.hasMore, page < 3);
          lidas.push(...corpo.avaliacoes.map((avaliacao) => avaliacao.id));
        }
        assert.deepEqual(lidas, esperada);
        assert.deepEqual((await pagina(4, 3)).corpo.avaliacoes, []);

        // A mesma página lida de novo vem igual, e outro leitor só muda quem aparece primeiro
        assert.deepEqual((await pagina(2, 3)).corpo.avaliacoes.map((x) => x.id), esperada.slice(3, 6));
        const estranha = await f.novoLeitor('Estranha');
        const paraEstranha = (await pagina(1, 20, estranha)).corpo.avaliacoes.map((x) => x.id);
        assert.deepEqual(paraEstranha, [a, e, d, c, b, g, minha].map((avaliacao) => avaliacao.id));
      });
    });

    // Sem contrato definido não há o que testar de verdade: um teste que inventasse a API só passaria a falsa
    // impressão de cobertura. Quem entregar cada card troca o todo por um cenário aqui, valendo para os dois modos.
    describe('pendente: depende de funcionalidade que ainda não existe na API', () => {
      test.todo('#171 mesma chave e mesmo corpo devolvem o mesmo comentário, inclusive em envios simultâneos');
      test.todo('#171 mesma chave com corpo diferente dá conflito, e a chave de um usuário não vale para outro');
      test.todo('#172 edição com versão antiga dá 409 sem sobrescrever, inclusive em duas sessões simultâneas');
      test.todo('#168 cursor de comentários: páginas sem repetição nem falta, com inclusão e exclusão entre as consultas');
    });

    cenariosDoModo?.(() => ({ api, f }));
  });
}

module.exports = { definirCenarios };
