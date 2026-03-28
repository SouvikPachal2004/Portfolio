require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'replace-me-in-production';
const OWNER_NAME = process.env.OWNER_NAME || 'Souvik Pachal';
const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.RECIPIENT_EMAIL || process.env.BREVO_FROM_EMAIL;
const OWNER_INBOX = process.env.RECIPIENT_EMAIL || OWNER_EMAIL;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || OWNER_EMAIL;
const REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const resumePath = path.join(__dirname, '..', 'frontend', 'resume.pdf');

app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Portfolio backend is running.' });
});

app.get('/resume.pdf', (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Direct resume access is disabled. Please request access from the portfolio website.'
  });
});

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

const resumeRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many resume requests. Please try again later.' }
});

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getMissingMailConfig() {
  const missing = [];

  if (!BREVO_API_KEY) missing.push('BREVO_API_KEY');
  if (!BREVO_FROM_EMAIL) missing.push('BREVO_FROM_EMAIL');
  if (!OWNER_INBOX) missing.push('RECIPIENT_EMAIL or OWNER_EMAIL');

  return missing;
}

function ensureMailConfig(res) {
  const missing = getMissingMailConfig();

  if (!missing.length) {
    return true;
  }

  return res.status(503).json({
    success: false,
    error: `Email service is not configured. Missing: ${missing.join(', ')}.`
  });
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifySignedToken(token, expectedType) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid token.');
  }

  const [body, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');

  if (
    !signature ||
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error('Invalid token signature.');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

  if (expectedType && payload.type !== expectedType) {
    throw new Error('Invalid token type.');
  }

  if (!payload.expiresAt || Number(payload.expiresAt) < Date.now()) {
    throw new Error('Token expired.');
  }

  return payload;
}

async function sendMail(options) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: OWNER_NAME,
        email: BREVO_FROM_EMAIL
      },
      to: (Array.isArray(options.to) ? options.to : [options.to]).map((email) => ({ email })),
      replyTo: options.replyTo ? { email: options.replyTo } : undefined,
      subject: options.subject,
      htmlContent: options.html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body;

  if (ensureMailConfig(res) !== true) {
    return;
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required.' });
  }
  if (!email || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Valid email is required.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message is required.' });
  }

  try {
    await sendMail({
      to: OWNER_INBOX,
      replyTo: email.trim(),
      subject: `Portfolio Contact from ${name.trim()}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">New Portfolio Message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
          <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
          <hr style="border-color:rgba(0,212,255,0.2);margin:1rem 0"/>
          <p><strong>Message:</strong></p>
          <p style="color:#9090b0;line-height:1.7">${escapeHtml(message.trim()).replace(/\n/g, '<br>')}</p>
        </div>`
    });
    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Contact email error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

app.post('/api/resume-request', resumeRequestLimiter, async (req, res) => {
  const { name, email, reason } = req.body;

  if (ensureMailConfig(res) !== true) {
    return;
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required.' });
  }
  if (!email || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Valid email is required.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: 'Reason is required.' });
  }

  const requesterName = name.trim();
  const requesterEmail = email.trim().toLowerCase();
  const requestReason = reason.trim();
  const approvalToken = signPayload({
    type: 'resume-approval',
    name: requesterName,
    email: requesterEmail,
    reason: requestReason,
    requestedAt: Date.now(),
    expiresAt: Date.now() + REQUEST_TTL_MS
  });
  const approvalLink = `${getBaseUrl(req)}/api/approve-resume?token=${encodeURIComponent(approvalToken)}`;

  try {
    await sendMail({
      to: OWNER_INBOX,
      replyTo: requesterEmail,
      subject: `[Resume Request] ${requesterName} wants your resume`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">&#128196; New Resume Request</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
            <tr><td style="padding:0.4rem 0;color:#7a9bbf;width:80px">Name</td>
                <td style="padding:0.4rem 0;font-weight:600">${escapeHtml(requesterName)}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#7a9bbf">Email</td>
                <td style="padding:0.4rem 0">${escapeHtml(requesterEmail)}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#7a9bbf">Reason</td>
                <td style="padding:0.4rem 0">${escapeHtml(requestReason)}</td></tr>
          </table>
          <hr style="border-color:rgba(0,212,255,0.15);margin:1.5rem 0"/>
          <p style="margin-bottom:1rem">Click below to approve this request. A secure, time-limited download link will then be emailed to the requester.</p>
          <a href="${approvalLink}"
            style="display:inline-block;padding:0.9rem 2.2rem;
              background:linear-gradient(135deg,#00d4ff,#3b82f6);
              color:#fff;border-radius:8px;text-decoration:none;
              font-weight:700;font-size:1rem;letter-spacing:0.3px">
            &#10003; Approve Resume Access
          </a>
          <p style="margin-top:1.5rem;color:#3d5a7a;font-size:0.82rem">
            If you don't recognise this request, simply ignore this email.
          </p>
        </div>`
    });
    return res.status(200).json({
      success: true,
      message: 'Request sent successfully. After approval, a secure resume link will be emailed to you.'
    });
  } catch (err) {
    console.error('Resume request error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send request. Please try again.' });
  }
});

app.get('/api/approve-resume', async (req, res) => {
  const { token } = req.query;
  let approvalPayload;

  try {
    approvalPayload = verifySignedToken(token, 'resume-approval');
  } catch (err) {
    return res.status(400).send(`<h2>${escapeHtml(err.message || 'Invalid approval link.')}</h2>`);
  }

  const requesterEmail = approvalPayload.email;
  const requesterName = approvalPayload.name;
  const downloadToken = signPayload({
    type: 'resume-download',
    name: requesterName,
    email: requesterEmail,
    approvedAt: Date.now(),
    expiresAt: Date.now() + DOWNLOAD_TTL_MS
  });
  const downloadLink = `${getBaseUrl(req)}/api/download-resume?token=${encodeURIComponent(downloadToken)}`;

  try {
    await sendMail({
      to: requesterEmail,
      subject: `Resume Access Approved - ${OWNER_NAME}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">Hi ${escapeHtml(requesterName)}!</h2>
          <p>Your request for ${escapeHtml(OWNER_NAME)}'s resume has been approved.</p>
          <p>Use the secure button below to download the resume. This link expires in 7 days.</p>
          <a href="${downloadLink}"
            style="display:inline-block;padding:0.9rem 2.2rem;
              background:linear-gradient(135deg,#00d4ff,#3b82f6);
              color:#fff;border-radius:8px;text-decoration:none;
              font-weight:700;font-size:1rem;letter-spacing:0.3px">
            Download Resume
          </a>
          <p style="margin-top:1rem;color:#7a9bbf;font-size:0.9rem">
            Feel free to reach out at
            <a href="mailto:${escapeHtml(OWNER_EMAIL)}" style="color:#00d4ff">${escapeHtml(OWNER_EMAIL)}</a>
            for any queries.
          </p>
          <hr style="border-color:rgba(0,212,255,0.15);margin:1.5rem 0"/>
          <p style="color:#3d5a7a;font-size:0.82rem">
            This secure link was sent from ${escapeHtml(OWNER_NAME)}'s portfolio website.
          </p>
        </div>`
    });

    return res.send(`
      <html>
        <head><title>Resume Request Approved</title></head>
        <body style="font-family:Inter,sans-serif;background:#060b14;color:#e2eaf4;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:2rem;background:#0d1628;border-radius:16px;
            border:1px solid rgba(0,212,255,0.2);max-width:420px">
            <div style="font-size:3rem;margin-bottom:1rem">&#10003;</div>
            <h2 style="color:#00d4ff;margin-bottom:0.5rem">Request Approved</h2>
            <p>A secure resume download link has been emailed to <strong>${escapeHtml(requesterEmail)}</strong>.</p>
          </div>
        </body>
      </html>`);
  } catch (err) {
    console.error('Approval error:', err.message);
    return res.status(500).send('<h2>Failed to send resume. Please try again.</h2>');
  }
});

app.get('/api/download-resume', (req, res) => {
  const { token } = req.query;

  try {
    const downloadPayload = verifySignedToken(token, 'resume-download');

    if (!fs.existsSync(resumePath)) {
      return res.status(404).send('<h2>Resume not found.</h2>');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${OWNER_NAME.replace(/\s+/g, '_')}_Resume.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Resume-Owner', OWNER_NAME);
    res.setHeader('X-Resume-Recipient', downloadPayload.email);

    return res.sendFile(resumePath);
  } catch (err) {
    return res.status(400).send(`<h2>${escapeHtml(err.message || 'Invalid download link.')}</h2>`);
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, signPayload, verifySignedToken };
