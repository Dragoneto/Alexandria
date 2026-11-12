// As variáveis precisam existir antes dos require: o mailer lê o ambiente ao enviar.
process.env.SMTP_USER = 'alexandria.app@gmail.com';
process.env.SMTP_PASS = 'senha-de-app';
delete process.env.SMTP_HOST;
delete process.env.SMTP_PORT;
delete process.env.MAIL_FROM;

const assert = require('node:assert/strict');
const { test } = require('node:test');
const nodemailer = require('nodemailer');

const mailer = require('../src/services/mailer');

test('manda o código pelo Gmail, com a validade e o aviso para quem não pediu', async (t) => {
  const enviados = [];
  const conexao = t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (mensagem) => enviados.push(mensagem),
  }));

  await mailer.sendResetCode('leitora@alexandria.com', '042137', 15);

  assert.deepEqual(conexao.mock.calls[0].arguments[0], {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'alexandria.app@gmail.com', pass: 'senha-de-app' },
  });
  assert.equal(enviados[0].from, 'Alexandria <alexandria.app@gmail.com>');
  assert.equal(enviados[0].to, 'leitora@alexandria.com');
  assert.match(enviados[0].subject, /redefinir a senha/);
  for (const corpo of [enviados[0].text, enviados[0].html]) {
    assert.match(corpo, /042137/);
    assert.match(corpo, /15 minutos/);
    assert.match(corpo, /Se você não pediu/);
  }
});

test('sem a conta ou sem a senha de app, o envio fica desligado', () => {
  assert.equal(mailer.isConfigured(), true);

  delete process.env.SMTP_PASS;
  assert.equal(mailer.isConfigured(), false);
});

test('com BREVO_API_KEY, manda pela API do Brevo e não abre conexão SMTP', async (t) => {
  process.env.BREVO_API_KEY = 'xkeysib-teste';
  process.env.MAIL_FROM = 'Alexandria <alexandria.app@gmail.com>';
  const smtp = t.mock.method(nodemailer, 'createTransport', () => assert.fail('não deveria usar SMTP'));
  const fetchOriginal = global.fetch;
  const chamadas = [];
  global.fetch = async (url, options) => {
    chamadas.push({ url, options });
    return new Response(JSON.stringify({ messageId: '<1@brevo>' }), { status: 201 });
  };
  t.after(() => {
    global.fetch = fetchOriginal;
    delete process.env.BREVO_API_KEY;
    delete process.env.MAIL_FROM;
  });

  assert.equal(mailer.isConfigured(), true);
  await mailer.sendResetCode('leitora@alexandria.com', '042137', 15);

  assert.equal(smtp.mock.callCount(), 0);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(chamadas[0].options.method, 'POST');
  assert.equal(chamadas[0].options.headers['api-key'], 'xkeysib-teste');
  const corpo = JSON.parse(chamadas[0].options.body);
  assert.deepEqual(corpo.sender, { name: 'Alexandria', email: 'alexandria.app@gmail.com' });
  assert.deepEqual(corpo.to, [{ email: 'leitora@alexandria.com' }]);
  assert.match(corpo.subject, /redefinir a senha/);
  for (const texto of [corpo.textContent, corpo.htmlContent]) {
    assert.match(texto, /042137/);
    assert.match(texto, /15 minutos/);
  }
});

test('Brevo recusando o envio vira erro com o status, para aparecer no log', async (t) => {
  process.env.BREVO_API_KEY = 'xkeysib-teste';
  process.env.MAIL_FROM = 'alexandria.app@gmail.com';
  const fetchOriginal = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 });
  t.after(() => {
    global.fetch = fetchOriginal;
    delete process.env.BREVO_API_KEY;
    delete process.env.MAIL_FROM;
  });

  await assert.rejects(mailer.sendResetCode('leitora@alexandria.com', '1', 15), /Brevo recusou o envio \(401\).*Key not found/);
});

test('Brevo sem remetente válido conta como não configurado', (t) => {
  process.env.BREVO_API_KEY = 'xkeysib-teste';
  const smtpUser = process.env.SMTP_USER;
  delete process.env.SMTP_USER;
  delete process.env.MAIL_FROM;
  t.after(() => {
    delete process.env.BREVO_API_KEY;
    process.env.SMTP_USER = smtpUser;
  });

  assert.equal(mailer.isConfigured(), false);
  process.env.MAIL_FROM = 'Nome sem email';
  assert.equal(mailer.isConfigured(), false);
  process.env.MAIL_FROM = '"Alexandria App" <app@exemplo.com>';
  assert.equal(mailer.isConfigured(), true);
});
