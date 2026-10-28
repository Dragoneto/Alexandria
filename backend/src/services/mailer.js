const nodemailer = require('nodemailer');

let transporter = null;

/** Só manda e-mail de verdade com conta e senha de app no .env; sem elas, o código vai para o log. */
function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
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

/** Envia o código de redefinição de senha. Lança erro se o servidor de e-mail recusar. */
async function sendResetCode(email, codigo, minutos) {
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `Alexandria <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu código para redefinir a senha do Alexandria',
    text: `Seu código para redefinir a senha é ${codigo}. Ele vale por ${minutos} minutos.\n\nSe você não pediu, ignore este e-mail.`,
    html: `<p>Seu código para redefinir a senha é:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>
<p>Ele vale por ${minutos} minutos.</p>
<p>Se você não pediu, ignore este e-mail.</p>`,
  });
}

module.exports = { isConfigured, sendResetCode };
