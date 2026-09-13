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
    console.log('\n' + '='.repeat(60));
    console.log(`[JanSetu Email OTP - DEV FALLBACK]`);
    console.log(`To: ${email}`);
    console.log(`Verification Code: >>> ${code} <<<`);
    console.log(`(Configure SMTP_USER & SMTP_PASS in .env to send real emails)`);
    console.log('='.repeat(60) + '\n');
    return { sent: false, devMode: true, code };
  }
  try {
    await mailer.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: email,
      subject: 'JanSetu email verification code',
      text: `Your JanSetu verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
      html: `<p>Your JanSetu verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#1e40af">${code}</p><p>This code expires in 10 minutes. Do not share it.</p>`,
    });
    return { sent: true, devMode: false, code };
  } catch (err) {
    console.error('[SMTP ERROR] Failed to send email via SMTP:', err.message);
    if (!env.IS_PROD) {
      console.log('\n' + '='.repeat(60));
      console.log(`[JanSetu Email OTP - DEV FALLBACK (SMTP Error)]`);
      console.log(`To: ${email}`);
      console.log(`Verification Code: >>> ${code} <<<`);
      console.log('='.repeat(60) + '\n');
      return { sent: false, devMode: true, code, smtpError: err.message };
    }
    throw err;
  }
}

module.exports = { sendEmailVerificationOtp, getTransporter };
