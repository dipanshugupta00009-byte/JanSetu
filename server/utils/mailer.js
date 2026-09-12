const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

async function sendGmailOtp(email, otp) {
  const mailer = getTransporter();
  if (!mailer) throw new Error('Gmail verification email is not configured on this server.');
  await mailer.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: email,
    subject: 'JanSetu Gmail verification code',
    text: `Your JanSetu verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
    html: `<p>Your JanSetu verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 10 minutes. Do not share it.</p>`,
  });
}

module.exports = { sendGmailOtp };
