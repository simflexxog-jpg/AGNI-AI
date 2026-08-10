require('dotenv').config();
const nodemailer = require('nodemailer');

function createEmailTransporter() {
  if (process.env.EMAIL_SERVICE) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: process.env.EMAIL_USER ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      } : undefined
    });
  }

  console.log('no transporter config');
  process.exit(0);
}

const transporter = createEmailTransporter();
console.log('transporter created?', !!transporter);
if (!transporter) process.exit(0);

const to = process.env.EMAIL_USER;
const from = process.env.EMAIL_FROM || to;
const message = {
  from,
  to,
  subject: 'SMTP test from AGNI AI',
  text: 'This is a test message from your AGNI AI password reset SMTP configuration.',
};

transporter.sendMail(message).then(info => {
  console.log('Send succeeded:', info.response || info.messageId || info);
  process.exit(0);
}).catch(err => {
  console.error('Send failed:');
  console.error(err && err.message ? err.message : err);
  if (err && err.response) console.error('response:', err.response);
  if (err && err.code) console.error('code:', err.code);
  process.exit(1);
});
