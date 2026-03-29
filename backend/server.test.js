const request = require('supertest');

const mockFetch = jest.fn();
global.fetch = mockFetch;

process.env.TOKEN_SECRET = 'test-secret';
process.env.BASE_URL = 'https://portfolio-backend-7ld7.onrender.com';
process.env.RECIPIENT_EMAIL = 'owner@example.com';
process.env.BREVO_API_KEY = 'xkeysib-test-key';
process.env.BREVO_FROM_EMAIL = 'owner@example.com';

const { app } = require('./server');

describe('resume permission flow', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'mock-email-id' }),
      text: async () => ''
    });
  });

  afterEach(() => {
    process.env.RECIPIENT_EMAIL = 'owner@example.com';
    process.env.OWNER_EMAIL = '';
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    process.env.BREVO_FROM_EMAIL = 'owner@example.com';
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
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.to).toEqual([{ email: 'owner@example.com' }]);
    expect(requestBody.htmlContent).toContain('/api/approve-resume?token=');
    expect(requestBody.htmlContent).not.toContain('email=recruiter%40example.com');
  });

  it('falls back to OWNER_EMAIL when RECIPIENT_EMAIL is not configured', async () => {
    process.env.RECIPIENT_EMAIL = '';
    process.env.OWNER_EMAIL = 'portfolio-owner@example.com';

    jest.resetModules();
    global.fetch = mockFetch;
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

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.to).toEqual([{ email: 'portfolio-owner@example.com' }]);
  });

  it('approves the request and emails the requester a secure download link', async () => {
    await request(app)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Two',
        email: 'recruiter2@example.com',
        reason: 'Interview process'
      });

    const ownerMail = JSON.parse(mockFetch.mock.calls[0][1].body);
    const tokenMatch = ownerMail.htmlContent.match(/approve-resume\?token=([^"]+)/);
    expect(tokenMatch).toBeTruthy();

    mockFetch.mockClear();

    const approvalResponse = await request(app)
      .get(`/api/approve-resume?token=${tokenMatch[1]}`);

    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.text).toContain('secure resume download link');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const requesterMail = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requesterMail.to).toEqual([{ email: 'recruiter2@example.com' }]);
    expect(requesterMail.htmlContent).toContain('/api/download-resume?token=');
  });

  it('downloads the resume only when a valid signed token is provided', async () => {
    await request(app)
      .post('/api/resume-request')
      .send({
        name: 'Recruiter Three',
        email: 'recruiter3@example.com',
        reason: 'Screening'
      });

    const ownerMail = JSON.parse(mockFetch.mock.calls[0][1].body);
    const approvalToken = ownerMail.htmlContent.match(/approve-resume\?token=([^"]+)/)[1];

    mockFetch.mockClear();

    await request(app).get(`/api/approve-resume?token=${approvalToken}`);

    const requesterMail = JSON.parse(mockFetch.mock.calls[0][1].body);
    const downloadToken = requesterMail.htmlContent.match(/download-resume\?token=([^"]+)/)[1];

    const forbiddenResponse = await request(app).get('/resume.pdf');
    expect(forbiddenResponse.status).toBe(403);

    const downloadResponse = await request(app)
      .get(`/api/download-resume?token=${downloadToken}`);

    expect(downloadResponse.status).toBe(302);
    expect(downloadResponse.headers.location).toContain('drive.google.com');
  });

  it('returns a clear config error when Brevo config is missing', async () => {
    process.env.BREVO_API_KEY = '';
    process.env.BREVO_FROM_EMAIL = '';

    jest.resetModules();
    global.fetch = mockFetch;
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
    expect(response.body.error).toContain('BREVO_API_KEY');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
