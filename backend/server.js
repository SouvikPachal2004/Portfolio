require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Health check — must be before static file serving
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Portfolio backend is running.' });
});

// Serve resume PDF statically from frontend folder
const resumePath = path.join(__dirname, '..', 'frontend', 'resume.pdf');
app.get('/resume.pdf', (req, res) => {
  if (fs.existsSync(resumePath)) {
    res.sendFile(resumePath);
  } else {
    res.status(404).send('Resume not found.');
  }
});

// Rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reusable transporter factory
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ─── POST /api/contact ────────────────────────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ success: false, error: 'Name is required.' });
  if (!email || !email.trim() || !EMAIL_REGEX.test(email.trim()))
    return res.status(400).json({ success: false, error: 'Valid email is required.' });
  if (!message || !message.trim())
    return res.status(400).json({ success: false, error: 'Message is required.' });

  try {
    await createTransporter().sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL,
      replyTo: email.trim(),
      subject: `Portfolio Contact from ${name.trim()}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">New Portfolio Message</h2>
          <p><strong>Name:</strong> ${name.trim()}</p>
          <p><strong>Email:</strong> ${email.trim()}</p>
          <hr style="border-color:rgba(0,212,255,0.2);margin:1rem 0"/>
          <p><strong>Message:</strong></p>
          <p style="color:#9090b0;line-height:1.7">${message.trim().replace(/\n/g, '<br>')}</p>
        </div>`
    });
    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Contact email error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

// ─── POST /api/resume-request ─────────────────────────────────────────────────
app.post('/api/resume-request', async (req, res) => {
  const { name, email, reason } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ success: false, error: 'Name is required.' });
  if (!email || !email.trim() || !EMAIL_REGEX.test(email.trim()))
    return res.status(400).json({ success: false, error: 'Valid email is required.' });
  if (!reason || !reason.trim())
    return res.status(400).json({ success: false, error: 'Reason is required.' });

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const approvalLink = `${baseUrl}/api/approve-resume?email=${encodeURIComponent(email.trim())}&name=${encodeURIComponent(name.trim())}`;

  try {
    await createTransporter().sendMail({
      from: `"Portfolio" <${process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL,
      subject: `[Resume Request] ${name.trim()} wants your resume`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">&#128196; New Resume Request</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
            <tr><td style="padding:0.4rem 0;color:#7a9bbf;width:80px">Name</td>
                <td style="padding:0.4rem 0;font-weight:600">${name.trim()}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#7a9bbf">Email</td>
                <td style="padding:0.4rem 0">${email.trim()}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#7a9bbf">Reason</td>
                <td style="padding:0.4rem 0">${reason.trim()}</td></tr>
          </table>
          <hr style="border-color:rgba(0,212,255,0.15);margin:1.5rem 0"/>
          <p style="margin-bottom:1rem">Click the button below to <strong>approve</strong> and automatically send your resume to this person:</p>
          <a href="${approvalLink}"
            style="display:inline-block;padding:0.9rem 2.2rem;
              background:linear-gradient(135deg,#00d4ff,#3b82f6);
              color:#fff;border-radius:8px;text-decoration:none;
              font-weight:700;font-size:1rem;letter-spacing:0.3px">
            &#10003; Approve &amp; Send Resume
          </a>
          <p style="margin-top:1.5rem;color:#3d5a7a;font-size:0.82rem">
            If you don't recognise this request, simply ignore this email.
          </p>
        </div>`
    });
    return res.status(200).json({
      success: true,
      message: 'Request sent! Souvik will review and email you the resume if approved.'
    });
  } catch (err) {
    console.error('Resume request error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send request. Please try again.' });
  }
});

// ─── GET /api/approve-resume ──────────────────────────────────────────────────
app.get('/api/approve-resume', async (req, res) => {
  const { email, name } = req.query;
  if (!email || !name)
    return res.status(400).send('<h2>Invalid approval link.</h2>');

  const requesterEmail = decodeURIComponent(email);
  const requesterName = decodeURIComponent(name);

  try {
    const mailOptions = {
      from: `"Souvik Pachal" <${process.env.SMTP_USER}>`,
      to: requesterEmail,
      subject: 'Resume Approved — Souvik Pachal',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
          background:#0f0f1a;color:#e8e8f0;padding:2rem;border-radius:12px;
          border:1px solid rgba(0,212,255,0.2)">
          <h2 style="color:#00d4ff">Hi ${requesterName}!</h2>
          <p>Souvik has approved your resume request. Please find the resume attached to this email.</p>
          <p style="margin-top:1rem;color:#7a9bbf;font-size:0.9rem">
            Feel free to reach out at
            <a href="mailto:souvikpachal2004@gmail.com" style="color:#00d4ff">souvikpachal2004@gmail.com</a>
            for any queries.
          </p>
          <hr style="border-color:rgba(0,212,255,0.15);margin:1.5rem 0"/>
          <p style="color:#3d5a7a;font-size:0.82rem">
            This email was sent from Souvik Pachal's portfolio website.
          </p>
        </div>`
    };

    // Attach resume if it exists
    if (fs.existsSync(resumePath)) {
      mailOptions.attachments = [{
        filename: 'Souvik_Pachal_Resume.pdf',
        path: resumePath
      }];
    }

    await createTransporter().sendMail(mailOptions);

    res.send(`
      <html>
        <head><title>Resume Sent</title></head>
        <body style="font-family:Inter,sans-serif;background:#060b14;color:#e2eaf4;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:2rem;background:#0d1628;border-radius:16px;
            border:1px solid rgba(0,212,255,0.2);max-width:400px">
            <div style="font-size:3rem;margin-bottom:1rem">&#10003;</div>
            <h2 style="color:#00d4ff;margin-bottom:0.5rem">Resume Sent!</h2>
            <p>Your resume has been emailed to <strong>${requesterEmail}</strong>.</p>
          </div>
        </body>
      </html>`);
  } catch (err) {
    console.error('Approval error:', err.message);
    res.status(500).send('<h2>Failed to send resume. Please try again.</h2>');
  }
});

// Start server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
