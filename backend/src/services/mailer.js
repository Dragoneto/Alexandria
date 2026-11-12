const nodemailer = require('nodemailer');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10000;

let transporter = null;

// Dois jeitos de enviar:
// - Brevo (BREVO_API_KEY): API por HTTPS, funciona no Render grátis, que bloqueia SMTP.
// - SMTP (SMTP_USER + SMTP_PASS): Gmail com senha de app, bom para rodar localmente.
// O Brevo tem prioridade quando os dois estão configurados.

function usaBrevo() {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

/** Só manda e-mail de verdade com Brevo ou SMTP configurado; sem eles, o código vai para o log. */
function isConfigured() {
  if (usaBrevo()) return Boolean(remetente().email);
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Lê MAIL_FROM no formato "Nome <email>" ou só "email". */
function remetente() {
  const valor = (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
  const comNome = valor.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (comNome) return { name: comNome[1].replace(/^"|"$/g, '').trim() || 'Alexandria', email: comNome[2] };
  return { name: 'Alexandria', email: /^[^<>\s]+@[^<>\s]+$/.test(valor) ? valor : '' };
}

// A conexão com o servidor de e-mail é montada no primeiro envio e reaproveitada nos seguintes
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function mensagemDoCodigo(codigo, minutos) {
  return {
    subject: 'Seu código para redefinir a senha do Alexandria',
    text: `Seu código para redefinir a senha é ${codigo}. Ele vale por ${minutos} minutos.\n\nSe você não pediu, ignore este e-mail.`,
    html: `<p>Seu código para redefinir a senha é:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>
<p>Ele vale por ${minutos} minutos.</p>
<p>Se você não pediu, ignore este e-mail.</p>`,
  };
}

async function enviarPeloBrevo(email, { subject, text, html }) {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: remetente(),
      to: [{ email }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
  });
  if (!response.ok) {
    // A mensagem do Brevo ajuda a achar o problema (chave errada, remetente não validado)
    const detalhe = await response.text().catch(() => '');
    throw new Error(`Brevo recusou o envio (${response.status}): ${detalhe.slice(0, 200)}`);
  }
}

/** Envia o código de redefinição de senha. Lança erro se o serviço de e-mail recusar. */
async function sendResetCode(email, codigo, minutos) {
  const mensagem = mensagemDoCodigo(codigo, minutos);
  if (usaBrevo()) return enviarPeloBrevo(email, mensagem);

  const { name, email: from } = remetente();
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `${name} <${from}>`,
    to: email,
    ...mensagem,
  });
}

module.exports = { isConfigured, sendResetCode };
