/**
 * JanSetu – Email Test Utility
 * Test if your Gmail SMTP credentials in .env work.
 * Usage: node scripts/test-email.js your-email@gmail.com
 */
require('dotenv').config();
const { sendEmailVerificationOtp } = require('../server/utils/mailer');

const targetEmail = process.argv[2] || process.env.SMTP_USER || 'dipanshugupta00009@gmail.com';

console.log('Testing Gmail SMTP configuration...');
console.log('SMTP_USER:', process.env.SMTP_USER || '(NOT SET)');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '********' : '(NOT SET - REQUIRED)');
console.log('Target Email:', targetEmail);

(async () => {
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`\nAttempting to send verification OTP (${code}) to ${targetEmail}...`);
    const res = await sendEmailVerificationOtp(targetEmail, code);
    if (res.sent) {
      console.log('\n SUCCESS! Verification email was delivered to mailbox:', targetEmail);
      console.log('Message ID:', res.messageId);
    } else if (res.devMode) {
      console.log('\n DEV MODE: Email was not sent because SMTP_PASS is missing in .env.');
      console.log('Please add your 16-character Google App Password to SMTP_PASS in .env!');
    }
  } catch (err) {
    console.error('\n FAILED to send email:', err.message);
  }
})();

