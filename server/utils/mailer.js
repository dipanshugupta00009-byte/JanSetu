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

async function sendEmailVerificationOtp(email, code) {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error('Email verification is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'JanSetu email verification code',
    text: `Your JanSetu verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
    html: `<p>Your JanSetu verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. Do not share it.</p>`,
  });
}

module.exports = { sendEmailVerificationOtp };
