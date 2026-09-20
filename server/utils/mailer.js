const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  const user = String(process.env.SMTP_USER || env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const host = String(process.env.SMTP_HOST || env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || env.SMTP_PORT, 10) || 587;
  const secure = String(process.env.SMTP_SECURE || env.SMTP_SECURE || '').toLowerCase() === 'true';

  if (!user || !pass) return null;

  const isGmail = host === 'smtp.gmail.com' || user.toLowerCase().endsWith('@gmail.com');
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendEmailVerificationOtp(email, code) {
  const mailer = getTransporter();
  const fromAddress = process.env.SMTP_FROM || env.SMTP_FROM || process.env.SMTP_USER || env.SMTP_USER;

  if (!mailer) {
    console.log('\n' + '='.repeat(60));
    console.log(`[JanSetu Email OTP - DEV FALLBACK]`);
    console.log(`To: ${email}`);
    console.log(`Verification Code: >>> ${code} <<<`);
    console.log(`NOTE: OTP was NOT emailed because SMTP_PASS is empty in .env.`);
    console.log(`Add your Google App Password to SMTP_PASS in .env to send to mailbox!`);
    console.log('='.repeat(60) + '\n');
    return { sent: false, devMode: true, code };
  }

  try {
    const info = await mailer.sendMail({
      from: fromAddress || 'JanSetu <no-reply@jansetu.gov>',
      to: email,
      subject: `${code} is your JanSetu verification code`,
      text: `Your JanSetu email verification code is: ${code}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, please ignore this email.`,
      html: `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
          <div style="text-align:center;margin-bottom:20px">
            <h2 style="color:#1e3a8a;margin:0 0 6px;font-size:24px">JanSetu · जनसेतु</h2>
            <p style="color:#64748b;font-size:14px;margin:0">Jharkhand Community Platform</p>
          </div>
          <div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;border:1px solid #e2e8f0">
            <p style="color:#334155;font-size:15px;margin:0 0 10px">Your Email Verification Code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;margin:8px 0;font-family:monospace">${code}</div>
            <p style="color:#64748b;font-size:13px;margin:10px 0 0">Valid for 10 minutes. Do not share this code with anyone.</p>
          </div>
          <p style="color:#64748b;font-size:12px;text-align:center;margin:0">
            If you did not request this verification code, you can safely ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`[JanSetu Mailer] Verification email successfully sent to ${email}. MessageId: ${info.messageId}`);
    return { sent: true, devMode: false, code, messageId: info.messageId };
  } catch (err) {
    console.error('[SMTP ERROR] Failed to send email via Gmail SMTP:', err.message);
    let userMsg = err.message;
    if (err.message.includes('Invalid login') || err.message.includes('BadCredentials') || err.message.includes('Username and Password not accepted')) {
      userMsg = 'Gmail rejected the login. Please use a 16-character Google App Password (not your normal Gmail password) in .env.';
    }
    if (!env.IS_PROD) {
      console.log('\n' + '='.repeat(60));
      console.log(`[JanSetu Email OTP - DEV FALLBACK (SMTP Error: ${err.message})]`);
      console.log(`To: ${email}`);
      console.log(`Verification Code: >>> ${code} <<<`);
      console.log('='.repeat(60) + '\n');
      return { sent: false, devMode: true, code, smtpError: userMsg };
    }
    throw new Error(userMsg);
  }
}

module.exports = { sendEmailVerificationOtp, getTransporter };
