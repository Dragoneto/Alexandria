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
