const request = require('supertest');

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}));

process.env.TOKEN_SECRET = 'test-secret';
process.env.BASE_URL = 'https://portfolio-backend-7ld7.onrender.com';
process.env.RECIPIENT_EMAIL = 'owner@example.com';
process.env.SMTP_USER = 'smtp@example.com';
process.env.SMTP_PASS = 'password';

const { app } = require('./server');

describe('resume permission flow', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'mocked-message-id' });
  });

  afterEach(() => {
    process.env.RECIPIENT_EMAIL = 'owner@example.com';
    process.env.OWNER_EMAIL = '';
    process.env.SMTP_USER = 'smtp@example.com';
    process.env.SMTP_PASS = 'password';
  });

  it('emails the owner a signed approval link when a resume request is submitted', async () => {
    const response = await request(app)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter One',
        email: 'recruiter@example.com',
        reason: 'Hiring review'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const ownerMail = mockSendMail.mock.calls[0][0];
    expect(ownerMail.to).toBe('owner@example.com');
    expect(ownerMail.html).toContain('/api/approve-resume?token=');
    expect(ownerMail.html).not.toContain('email=recruiter%40example.com');
  });

  it('falls back to OWNER_EMAIL when RECIPIENT_EMAIL is not configured', async () => {
    process.env.RECIPIENT_EMAIL = '';
    process.env.OWNER_EMAIL = 'portfolio-owner@example.com';

    jest.resetModules();
    const { app: fallbackApp } = require('./server');

    const response = await request(fallbackApp)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Fallback',
        email: 'recruiter-fallback@example.com',
        reason: 'Hiring review'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const ownerMail = mockSendMail.mock.calls[0][0];
    expect(ownerMail.to).toBe('portfolio-owner@example.com');
  });

  it('approves the request and emails the requester a secure download link', async () => {
    await request(app)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Two',
        email: 'recruiter2@example.com',
        reason: 'Interview process'
      });

    const ownerMail = mockSendMail.mock.calls[0][0];
    const tokenMatch = ownerMail.html.match(/approve-resume\?token=([^"]+)/);
    expect(tokenMatch).toBeTruthy();

    mockSendMail.mockClear();

    const approvalResponse = await request(app)
      .get(`/api/approve-resume?token=${tokenMatch[1]}`);

    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.text).toContain('secure resume download link');
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const requesterMail = mockSendMail.mock.calls[0][0];
    expect(requesterMail.to).toBe('recruiter2@example.com');
    expect(requesterMail.html).toContain('/api/download-resume?token=');
  });

  it('downloads the resume only when a valid signed token is provided', async () => {
    await request(app)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Three',
        email: 'recruiter3@example.com',
        reason: 'Screening'
      });

    const ownerMail = mockSendMail.mock.calls[0][0];
    const approvalToken = ownerMail.html.match(/approve-resume\?token=([^"]+)/)[1];

    mockSendMail.mockClear();

    await request(app).get(`/api/approve-resume?token=${approvalToken}`);

    const requesterMail = mockSendMail.mock.calls[0][0];
    const downloadToken = requesterMail.html.match(/download-resume\?token=([^"]+)/)[1];

    const forbiddenResponse = await request(app).get('/resume.pdf');
    expect(forbiddenResponse.status).toBe(403);

    const downloadResponse = await request(app)
      .get(`/api/download-resume?token=${downloadToken}`);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers['content-type']).toContain('application/pdf');
  });

  it('returns a clear config error when SMTP credentials are missing', async () => {
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';

    jest.resetModules();
    const { app: misconfiguredApp } = require('./server');

    const response = await request(misconfiguredApp)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Broken',
        email: 'recruiter-broken@example.com',
        reason: 'Review'
      });

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('SMTP_USER');
    expect(response.body.error).toContain('SMTP_PASS');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
