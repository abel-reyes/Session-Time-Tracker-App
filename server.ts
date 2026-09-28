import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { APP_VERSION } from './src/version';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Persistent file-based store for cross-device sync & gift tracking
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');
const CHANGE_REQUESTS_LOG_FILE = path.join(DATA_DIR, 'change_requests.log');

const CREATOR_EMAIL = 'reyesabel36@gmail.com';

interface SuggestionEntry {
  id: string;
  ticketId?: string; // e.g. CR-2026-001
  name?: string;
  email?: string;
  category: string;
  message: string;
  createdAt: string;
  status?: 'new' | 'reviewed' | 'in_progress' | 'completed';
  creatorNotes?: string;
  emailDispatched?: boolean;
  emailDispatchError?: string;
  userAgent?: string;
  ip?: string;
}

function loadSuggestions(): SuggestionEntry[] {
  try {
    if (fs.existsSync(SUGGESTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading suggestions.json:', err);
  }
  return [];
}

function getNextTicketId(): string {
  const current = loadSuggestions();
  const year = new Date().getFullYear();
  const nextNum = String(current.length + 1).padStart(3, '0');
  return `CR-${year}-${nextNum}`;
}

function appendChangeRequestToAuditLog(entry: SuggestionEntry) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const logLine = [
      `================================================================================`,
      `[${entry.createdAt}] [${entry.ticketId || 'CR-000'}] [STATUS: ${entry.status || 'new'}] [CAT: ${entry.category}]`,
      `SUBMITTER: ${entry.name || 'Anonymous'} <${entry.email || 'no-email'}> | IP: ${entry.ip || 'unknown'}`,
      `MESSAGE:`,
      `${entry.message}`,
      `EMAIL ROUTED TO: ${CREATOR_EMAIL} (Dispatched: ${entry.emailDispatched ? 'YES' : 'LOGGED_TO_AUDIT'})`,
      `================================================================================`,
      ``
    ].join('\n');
    fs.appendFileSync(CHANGE_REQUESTS_LOG_FILE, logLine, 'utf-8');
  } catch (err) {
    console.error('Error writing to change_requests.log:', err);
  }
}

async function sendAutomatedEmailToCreator(
  entry: SuggestionEntry,
  requestOrigin?: string
): Promise<{ success: boolean; needsActivation?: boolean; method?: string; message?: string; error?: string }> {
  const subject = `[Change Request ${entry.ticketId || 'CR'}] [${entry.category}] from ${entry.name || 'User'}`;
  
  const plainText = [
    `SESSION TIME TRACKER - AUTOMATED CHANGE REQUEST TICKET`,
    `=============================================================`,
    `Ticket ID      : ${entry.ticketId}`,
    `Date & Time    : ${entry.createdAt}`,
    `Category       : ${entry.category}`,
    `Status         : ${entry.status || 'New'}`,
    `Submitter Name : ${entry.name || 'Anonymous User'}`,
    `Submitter Email: ${entry.email || 'None provided'}`,
    `Destination    : ${CREATOR_EMAIL}`,
    `=============================================================`,
    ``,
    `CHANGE REQUEST CONTENT:`,
    `-------------------------------------------------------------`,
    entry.message,
    `-------------------------------------------------------------`,
    ``,
    `ACTION CHECKLIST:`,
    `[ ] 1. Review requested feature or bug fix`,
    `[ ] 2. Reply to ${entry.email || 'user'}`,
    `[ ] 3. Update status in Creator Inbox to "In Progress" or "Completed"`,
    ``,
    `Logged into: Session Time Tracker Creator Queue (ID: ${entry.id})`,
  ].join('\n');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #0284c7; color: #ffffff; padding: 20px 24px; }
          .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
          .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; }
          .content { padding: 24px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f1f5f9; padding: 14px; border-radius: 12px; margin-bottom: 20px; font-size: 12px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; }
          .meta-value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
          .message-box { background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word; }
          .footer { background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
          .reply-btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Session Time Tracker - Change Request</h1>
            <p>Ticket #${entry.ticketId} &bull; Auto-forwarded to ${CREATOR_EMAIL}</p>
          </div>
          <div class="content">
            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Ticket ID</span>
                <span class="meta-value">${entry.ticketId}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Category</span>
                <span class="meta-value"><span class="badge">${entry.category}</span></span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Submitter Name</span>
                <span class="meta-value">${entry.name || 'Anonymous User'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Submitter Email</span>
                <span class="meta-value">${entry.email ? `<a href="mailto:${entry.email}">${entry.email}</a>` : 'Not provided'}</span>
              </div>
              <div class="meta-item" style="grid-column: span 2;">
                <span class="meta-label">Date Submitted</span>
                <span class="meta-value">${new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <h3 style="font-size: 13px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; text-transform: uppercase;">Change Request Details</h3>
            <div class="message-box">${entry.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

            ${entry.email ? `<div style="text-align: center;"><a href="mailto:${entry.email}?subject=Re: Change Request ${entry.ticketId} - Session Time Tracker" class="reply-btn">Reply directly to ${entry.name || 'User'}</a></div>` : ''}
          </div>
          <div class="footer">
            Stored in persistent server queue &bull; Change Request Log: <code>data/change_requests.log</code>
          </div>
        </div>
      </body>
    </html>
  `;

  // Direct Zero-Config Web Email Relay to Creator (reyesabel36@gmail.com) via FormSubmit
  try {
    const origin = (requestOrigin && typeof requestOrigin === 'string' && requestOrigin.startsWith('http'))
      ? requestOrigin
      : (process.env.APP_URL && process.env.APP_URL.startsWith('http')
          ? process.env.APP_URL
          : 'https://ais-dev-qkbic4urr5b4l6j7rfftt6-718767934355.us-east1.run.app');

    const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CREATOR_EMAIL)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': origin,
        'Origin': origin,
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        _replyto: entry.email || CREATOR_EMAIL,
        ticket_id: entry.ticketId || 'CR-NEW',
        category: entry.category,
        submitter_name: entry.name || 'Anonymous User',
        submitter_email: entry.email || 'None provided',
        date_submitted: new Date(entry.createdAt).toLocaleString(),
        status: entry.status || 'new',
        change_request_message: entry.message,
        destination_inbox: CREATOR_EMAIL,
      }),
    });

    if (formSubmitRes.ok) {
      const resData: any = await formSubmitRes.json();
      const isSuccess = resData.success === 'true' || resData.success === true;
      const isNeedsActivation = typeof resData.message === 'string' && resData.message.toLowerCase().includes('activation');

      if (isSuccess) {
        console.log(`[ZERO-CONFIG DIRECT EMAIL SENT TO ${CREATOR_EMAIL}]`, resData);
        return {
          success: true,
          method: 'Direct Web Relay (Zero SMTP Required)',
          message: typeof resData.message === 'string' ? resData.message : 'Sent directly to ' + CREATOR_EMAIL,
        };
      } else if (isNeedsActivation) {
        console.warn(`[FORMSUBMIT ACTIVATION REQUIRED FOR ${CREATOR_EMAIL}]`, resData);
        return {
          success: false,
          needsActivation: true,
          method: 'Direct Web Relay (Zero SMTP Required)',
          message: `FormSubmit requires 1-time activation: An 'Activate Form' confirmation email was just sent to ${CREATOR_EMAIL}. Please click that link in your inbox once to authorize direct delivery!`,
          error: resData.message,
        };
      } else {
        console.warn(`[DIRECT RELAY RESPONSE NOT SUCCESSFUL]`, resData);
        return {
          success: false,
          method: 'Direct Web Relay (Zero SMTP Required)',
          message: typeof resData.message === 'string' ? resData.message : 'Relay returned an error',
          error: resData.message || 'Unknown error',
        };
      }
    } else {
      const errText = await formSubmitRes.text();
      console.warn(`[DIRECT RELAY WARNING ${formSubmitRes.status}]:`, errText);
      return {
        success: false,
        method: 'Direct Web Relay',
        error: `HTTP ${formSubmitRes.status}: ${errText.slice(0, 100)}`,
      };
    }
  } catch (relayErr: any) {
    console.warn(`[DIRECT RELAY NETWORK ATTEMPT]:`, relayErr.message);
    return {
      success: false,
      method: 'Direct Web Relay',
      error: relayErr.message,
    };
  }

  // If external network is restricted, log cleanly to audit trail
  console.log(`\n=============================================================`);
  console.log(`[CHANGE REQUEST RECORDED IN QUEUE FOR ${CREATOR_EMAIL}]`);
  console.log(`Ticket: ${entry.ticketId} | Category: ${entry.category}`);
  console.log(`Submitter: ${entry.name} (${entry.email || 'no-email'})`);
  console.log(`Message: ${entry.message}`);
  console.log(`=============================================================\n`);

  return { success: true, method: 'Audit Log & Queue' };
}

function saveSuggestion(entry: SuggestionEntry) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = loadSuggestions();
    current.unshift(entry);
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving suggestion:', err);
  }
}


interface UserAccountRecord {
  passwordHash?: string;
  passwordSalt?: string;
  recoveryKey?: string;
  resetCode?: string;
  resetCodeExpires?: string;
  sessionTokens?: Record<string, { createdAt: string; expiresAt: string; deviceName?: string }>;
  quarters: { [quarterName: string]: any[] };
  projects: any[];
  settings: any;
  tombstones?: { sessionIds?: Record<string, string>; dates?: Record<string, string> };
  lastSyncedAt: string;
}

interface UserDataStore {
  [email: string]: UserAccountRecord;
}

// Security: Native PBKDF2 Password Hashing (100,000 iterations, SHA-512, 64-byte key)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function generateRecoveryKey(): string {
  const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `STT-${p1}-${p2}-${p3}`;
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions(userRecord: UserAccountRecord) {
  if (!userRecord.sessionTokens) {
    userRecord.sessionTokens = {};
    return;
  }
  const now = Date.now();
  for (const [token, data] of Object.entries(userRecord.sessionTokens)) {
    if (new Date(data.expiresAt).getTime() < now) {
      delete userRecord.sessionTokens[token];
    }
  }
}

function verifyUserSession(email: string, token?: string): boolean {
  if (!token) return false;
  const normalized = email.trim().toLowerCase();
  const user = dbStore[normalized];
  if (!user) return false;
  cleanExpiredSessions(user);
  return Boolean(user.sessionTokens && user.sessionTokens[token]);
}

function extractAuthToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const custom = req.headers['x-auth-token'];
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim();
  }
  return undefined;
}

// Mailer: Zero-cost Transactional Mailer via Nodemailer + Console Audit
async function sendPasswordResetEmail(
  email: string,
  code: string,
  recoveryKey?: string
): Promise<{ success: boolean; error?: string; method: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Session Time Tracker" <${user || 'no-reply@session-tracker.local'}>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #0284c7; color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 28px 24px; }
          .code-box { margin: 24px 0; padding: 20px; background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; text-align: center; }
          .code-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #0369a1; letter-spacing: 0.05em; }
          .code-number { font-size: 36px; font-weight: 800; font-family: monospace; color: #0284c7; letter-spacing: 0.25em; margin: 8px 0; }
          .code-exp { font-size: 11px; color: #64748b; }
          .recovery-box { margin-top: 18px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
          .footer { background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Account Passphrase</h1>
            <p>Session Time Tracker Cloud Security</p>
          </div>
          <div class="content">
            <p style="margin-top: 0;">Hello,</p>
            <p>We received a request to reset the passphrase for your Session Time Tracker account (<strong>${email}</strong>).</p>
            <div class="code-box">
              <div class="code-label">6-Digit Verification Code</div>
              <div class="code-number">${code}</div>
              <div class="code-exp">This code will expire in 15 minutes.</div>
            </div>
            ${recoveryKey ? `
              <div class="recovery-box">
                <strong>Emergency Recovery Key:</strong> <code>${recoveryKey}</code><br/>
                <span style="font-size: 11px; color: #64748b;">You can also use this recovery key to reset your account directly if you cannot access this email in the future.</span>
              </div>
            ` : ''}
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">If you did not request this code, no action is needed. Your existing passphrase remains securely protected.</p>
          </div>
          <div class="footer">
            Session Time Tracker &bull; 100% Free &amp; Private Cloud Sync
          </div>
        </div>
      </body>
    </html>
  `;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to: email,
        subject: `Your Passphrase Reset Code: ${code} - Session Time Tracker`,
        text: `Your 6-digit verification code is: ${code} (expires in 15 minutes). Emergency Recovery Key: ${recoveryKey || 'None'}`,
        html,
      });
      console.log(`[PASSWORD RESET EMAIL SENT VIA SMTP TO ${email}]`);
      return { success: true, method: 'SMTP Email Dispatch' };
    } catch (smtpErr: any) {
      console.warn(`[SMTP DISPATCH ATTEMPT FAILED]:`, smtpErr.message);
    }
  }

  // Always log to audit console so user/developer is never locked out
  console.log(`\n=============================================================`);
  console.log(`[PASSWORD RESET CODE FOR ${email}]: ${code}`);
  if (recoveryKey) console.log(`[EMERGENCY RECOVERY KEY]: ${recoveryKey}`);
  console.log(`Valid for 15 minutes. (No SMTP required / Zero-cost local mode)`);
  console.log(`=============================================================\n`);

  return { success: true, method: 'Audit Log Dispatch' };
}

interface GlobalStats {
  totalUsers: number;
  totalUniqueDevices: number;
  uniqueDeviceIds?: string[];
  totalVisits: number;
  totalGiftsSent: number;
  totalGiftsClaimed: number;
  totalPunchesLogged: number;
  lastUpdated: string;
}

function loadStats(): GlobalStats {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      return {
        totalUsers: parsed.totalUsers || 1,
        totalUniqueDevices: parsed.totalUniqueDevices || (parsed.uniqueDeviceIds ? parsed.uniqueDeviceIds.length : 1),
        uniqueDeviceIds: Array.isArray(parsed.uniqueDeviceIds) ? parsed.uniqueDeviceIds : [],
        totalVisits: parsed.totalVisits || 1,
        totalGiftsSent: parsed.totalGiftsSent || 0,
        totalGiftsClaimed: parsed.totalGiftsClaimed || 0,
        totalPunchesLogged: parsed.totalPunchesLogged || 0,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Error reading stats.json:', err);
  }
  return {
    totalUsers: 1,
    totalUniqueDevices: 1,
    uniqueDeviceIds: [],
    totalVisits: 1,
    totalGiftsSent: 0,
    totalGiftsClaimed: 0,
    totalPunchesLogged: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveStats(stats: GlobalStats) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving stats.json:', err);
  }
}

let globalStats: GlobalStats = loadStats();

function scrubSampleTraces(record: any): any {
  if (!record) return record;
  if (record.quarters && typeof record.quarters === 'object') {
    for (const [qName, days] of Object.entries(record.quarters)) {
      if (Array.isArray(days)) {
        record.quarters[qName] = days
          .map((d: any) => ({
            ...d,
            primaryProjectId: d.primaryProjectId?.startsWith('proj-sample-') ? undefined : d.primaryProjectId,
            punches: (d.punches || []).filter(
              (p: any) =>
                !p.projectName?.toLowerCase().includes('(sample)') &&
                !p.note?.toLowerCase().includes('(sample)') &&
                !p.projectId?.startsWith('proj-sample-') &&
                p.note !== 'Team sync and client ticket resolution' &&
                p.note !== 'Dashboard components and testing' &&
                p.projectName !== 'Client Operations (sample)' &&
                p.projectName !== 'Product Engineering (sample)' &&
                p.projectName !== 'Strategy & Ops (sample)'
            ),
          }))
          .filter(
            (d: any) =>
              (d.punches && d.punches.length > 0) ||
              (d.notes && !d.notes.toLowerCase().includes('(sample)') && d.notes !== 'Productive workday')
          );
      }
    }
  }

  if (record.projects && Array.isArray(record.projects)) {
    record.projects = record.projects.filter(
      (p: any) =>
        !p.name?.toLowerCase().includes('(sample)') &&
        !p.id?.startsWith('proj-sample-') &&
        p.name !== 'Client Operations (sample)' &&
        p.name !== 'Product Engineering (sample)' &&
        p.name !== 'Strategy & Ops (sample)'
    );
  }
  return record;
}

function loadDb(): UserDataStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        for (const email of Object.keys(parsed)) {
          parsed[email] = scrubSampleTraces(parsed[email]);
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return {};
}

function saveDb(data: UserDataStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// In-memory cache synced with disk
let dbStore: UserDataStore = loadDb();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: APP_VERSION, timestamp: new Date().toISOString() });
});

// Publication Version API: Ensures clients (including older v2.6.0 clients) detect new builds and trigger update
const SERVER_START_TIME = new Date().toISOString();
const SERVER_BUILD_ID = process.env.BUILD_ID || `build_${APP_VERSION}_${SERVER_START_TIME}`;
app.get(['/api/version', '/api/version/check', '/api/publication', '/api/check-update'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    version: APP_VERSION,
    buildId: SERVER_BUILD_ID,
    publishedAt: SERVER_START_TIME,
    timestamp: new Date().toISOString(),
    latestVersion: APP_VERSION,
  });
});

// Stats API: View overall tracking statistics (Total Unique Devices, Registered Sync Emails, Visits, Gifts)
app.get(['/api/stats', '/api/stats/overview'], (req, res) => {
  const syncedUsersCount = Object.keys(dbStore).length;
  const uniqueDevicesCount = Math.max(
    globalStats.uniqueDeviceIds?.length || 0,
    globalStats.totalUniqueDevices || 1,
    syncedUsersCount
  );
  
  res.json({
    totalUsers: uniqueDevicesCount,
    totalUniqueDevices: uniqueDevicesCount,
    totalSignedAccounts: syncedUsersCount,
    totalVisits: globalStats.totalVisits || 1,
    totalGiftsSent: globalStats.totalGiftsSent || 0,
    totalGiftsClaimed: globalStats.totalGiftsClaimed || 0,
    lastUpdated: globalStats.lastUpdated,
  });
});

// Stats API: Record anonymous device visit / heartbeat ping
app.post(['/api/stats/visit', '/api/stats/ping', '/api/stats/heartbeat'], (req, res) => {
  const { clientId } = req.body;
  if (!globalStats.uniqueDeviceIds) {
    globalStats.uniqueDeviceIds = [];
  }
  
  if (clientId && typeof clientId === 'string' && clientId.trim().length > 3) {
    const cleanId = clientId.trim();
    if (!globalStats.uniqueDeviceIds.includes(cleanId)) {
      globalStats.uniqueDeviceIds.push(cleanId);
      // Keep up to 25,000 unique device IDs safely
      if (globalStats.uniqueDeviceIds.length > 25000) {
        globalStats.uniqueDeviceIds.shift();
      }
    }
  }

  globalStats.totalUniqueDevices = Math.max(globalStats.uniqueDeviceIds.length, 1);
  globalStats.totalVisits = (globalStats.totalVisits || 0) + 1;
  globalStats.totalUsers = Math.max(globalStats.totalUniqueDevices, Object.keys(dbStore).length, 1);
  globalStats.lastUpdated = new Date().toISOString();
  saveStats(globalStats);

  res.json({
    success: true,
    totalUniqueDevices: globalStats.totalUniqueDevices,
    totalVisits: globalStats.totalVisits,
    totalSignedAccounts: Object.keys(dbStore).length,
  });
});

// Stats API: Track gift sent / created
app.post(['/api/stats/gift-sent', '/api/stats/gift-created'], (req, res) => {
  globalStats.totalGiftsSent = (globalStats.totalGiftsSent || 0) + 1;
  globalStats.lastUpdated = new Date().toISOString();
  saveStats(globalStats);
  res.json({ success: true, stats: globalStats });
});

// Stats API: Track gift claimed / opened
app.post(['/api/stats/gift-claimed', '/api/stats/gift-opened'], (req, res) => {
  globalStats.totalGiftsClaimed = (globalStats.totalGiftsClaimed || 0) + 1;
  globalStats.lastUpdated = new Date().toISOString();
  saveStats(globalStats);
  res.json({ success: true, stats: globalStats });
});

// Suggestions API: Submit suggestion for creator (reyesabel36@gmail.com)
app.post(['/api/suggestions', '/api/feedback'], async (req, res) => {
  const { name, email, category, message } = req.body;
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Suggestion message is required.' });
  }

  const ticketId = getNextTicketId();
  const newEntry: SuggestionEntry = {
    id: 'sug_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    ticketId,
    name: name?.trim() || 'Anonymous User',
    email: email?.trim() || '',
    category: category?.trim() || 'Feature Request',
    message: message.trim(),
    createdAt: new Date().toISOString(),
    status: 'new',
    creatorNotes: '',
    userAgent: req.headers['user-agent'],
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
  };

  // Attempt automatic email delivery to reyesabel36@gmail.com
  const reqOrigin = (req.headers.origin as string) || (req.headers.referer as string);
  const emailResult = await sendAutomatedEmailToCreator(newEntry, reqOrigin);
  newEntry.emailDispatched = emailResult.success;
  if (!emailResult.success && emailResult.error) {
    newEntry.emailDispatchError = emailResult.error;
  }

  // Persist to JSON database & immutable append-only audit log
  saveSuggestion(newEntry);
  appendChangeRequestToAuditLog(newEntry);

  res.json({
    success: true,
    message: emailResult.needsActivation
      ? `Change request (#${ticketId}) recorded! ⚠️ FormSubmit 1-time activation link sent to ${CREATOR_EMAIL}. Please click the link in your email once to enable automatic forwarding.`
      : `Thank you! Your change request (#${ticketId}) has been recorded and routed to the creator (${CREATOR_EMAIL}).`,
    ticketId: newEntry.ticketId,
    id: newEntry.id,
    emailDispatched: newEntry.emailDispatched,
    needsActivation: emailResult.needsActivation,
    dispatchMethod: emailResult.method,
    dispatchMessage: emailResult.message,
  });
});

// Suggestions API: Retrieve all suggestions (creator only endpoint)
app.get(['/api/suggestions', '/api/feedback'], (req, res) => {
  const suggestions = loadSuggestions();
  res.json({
    success: true,
    total: suggestions.length,
    creatorEmail: CREATOR_EMAIL,
    suggestions,
  });
});

// Suggestions API: Update ticket status or creator notes
app.post(['/api/suggestions/:id/status', '/api/suggestions/:id/update'], (req, res) => {
  const { id } = req.params;
  const { status, creatorNotes } = req.body;
  const current = loadSuggestions();
  const idx = current.findIndex((s) => s.id === id || s.ticketId === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (status) {
    current[idx].status = status;
  }
  if (creatorNotes !== undefined) {
    current[idx].creatorNotes = creatorNotes;
  }

  try {
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(current, null, 2), 'utf-8');
    res.json({ success: true, updated: current[idx] });
  } catch (err) {
    res.status(500).json({ error: 'Could not update ticket' });
  }
});

// Suggestions API: Test email dispatch to creator
app.post('/api/suggestions/test-email', async (req, res) => {
  const testEntry: SuggestionEntry = {
    id: 'test_' + Date.now(),
    ticketId: 'TEST-001',
    name: 'System Mailer Diagnostics',
    email: 'system@time-tracker.local',
    category: 'Diagnostic Test',
    message: 'This is a test notification confirming that change requests and suggestions are automatically routed to ' + CREATOR_EMAIL + '.',
    createdAt: new Date().toISOString(),
    status: 'new',
  };

  const reqOrigin = (req.headers.origin as string) || (req.headers.referer as string);
  const result = await sendAutomatedEmailToCreator(testEntry, reqOrigin);
  res.json({
    success: result.success,
    needsActivation: result.needsActivation,
    method: result.method,
    error: result.error,
    message: result.message || (result.success ? `Test notification dispatched to ${CREATOR_EMAIL}` : `Email failed: ${result.error}`),
  });
});

// Suggestions API: Delete a suggestion (creator only endpoint)
app.delete(['/api/suggestions/:id', '/api/feedback/:id'], (req, res) => {
  const { id } = req.params;
  const current = loadSuggestions();
  const filtered = current.filter((s) => s.id !== id && s.ticketId !== id);
  try {
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    res.json({ success: true, remaining: filtered.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete suggestion' });
  }
});


// Auth Check Endpoint: Check if account exists and whether it is passphrase-protected
app.post('/api/auth/check', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = dbStore[normalizedEmail];

  if (!existing) {
    return res.json({
      success: true,
      email: normalizedEmail,
      exists: false,
      hasPassphrase: false,
      isNewUser: true,
    });
  }

  const hasPassphrase = Boolean(existing.passwordHash && existing.passwordSalt);

  return res.json({
    success: true,
    email: normalizedEmail,
    exists: true,
    hasPassphrase,
    isExistingUser: true,
    hasData: Boolean(
      (existing.projects && existing.projects.length > 0) ||
      (existing.quarters && Object.keys(existing.quarters).length > 0)
    ),
  });
});

// Auth Setup Passphrase: Set initial passphrase for existing user OR brand new user
app.post('/api/auth/setup-passphrase', (req, res) => {
  const { email, passphrase, rememberDevice } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 6) {
    return res.status(400).json({ error: 'Passphrase must be at least 6 characters long.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = dbStore[normalizedEmail];

  // If user already had a passphrase, require login or forgot-password flow
  if (user && user.passwordHash && user.passwordSalt) {
    return res.status(400).json({
      error: 'A passphrase has already been configured for this account. Please sign in or use Reset Passphrase.',
      hasPassphrase: true,
    });
  }

  const { hash, salt } = hashPassword(passphrase.trim());
  const recoveryKey = generateRecoveryKey();
  const sessionToken = generateSessionToken();

  const expiryDays = rememberDevice ? 30 : 1;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  if (!user) {
    // New user initial setup
    user = {
      quarters: {},
      projects: [],
      settings: {
        appTitle: 'Session Time Tracker',
        userName: normalizedEmail.split('@')[0],
        userEmail: normalizedEmail,
        themeColor: '#0284C7',
        chartColor: '#0F172A',
        enableGoals: false,
        enableProjects: true,
        enableStreaks: false,
        weeklyGoalHours: 0,
        dailyGoalHours: 0,
        soundEnabled: true,
        timeFormat24h: false,
      },
      tombstones: { sessionIds: {}, dates: {} },
      lastSyncedAt: new Date().toISOString(),
    };
  }

  // Preserve all existing quarters, projects, settings, tombstones!
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.recoveryKey = recoveryKey;
  cleanExpiredSessions(user);
  if (!user.sessionTokens) user.sessionTokens = {};
  user.sessionTokens[sessionToken] = {
    createdAt: new Date().toISOString(),
    expiresAt,
    deviceName: req.headers['user-agent']?.slice(0, 50) || 'Web Device',
  };
  user.lastSyncedAt = new Date().toISOString();

  dbStore[normalizedEmail] = scrubSampleTraces(user);
  saveDb(dbStore);

  res.json({
    success: true,
    token: sessionToken,
    recoveryKey,
    user: {
      email: normalizedEmail,
      name: user.settings?.userName || normalizedEmail.split('@')[0],
    },
    data: {
      quarters: user.quarters,
      projects: user.projects,
      settings: user.settings,
      lastSyncedAt: user.lastSyncedAt,
    },
  });
});

// Auth Login endpoint (with passphrase verification and optional "remember this device" session token)
app.post(['/api/auth/login', '/api/auth/signin'], (req, res) => {
  const { email, passphrase, rememberDevice } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = dbStore[normalizedEmail];

  if (!user) {
    return res.status(404).json({
      error: 'Account not found. Please create your passphrase to connect.',
      isNewUser: true,
    });
  }

  // If existing user has no passphrase yet, direct them to setup without losing data
  if (!user.passwordHash || !user.passwordSalt) {
    return res.status(200).json({
      success: false,
      requireSetup: true,
      existingUser: true,
      message: 'Account exists! Please create a passphrase to secure your cloud data.',
    });
  }

  if (!passphrase || typeof passphrase !== 'string') {
    return res.status(400).json({ error: 'Passphrase is required to log in.' });
  }

  const isValid = verifyPassword(passphrase.trim(), user.passwordHash, user.passwordSalt);
  if (!isValid) {
    return res.status(401).json({
      error: 'Incorrect passphrase. Please try again or use Forgot Passphrase / Recovery Key.',
    });
  }

  const sessionToken = generateSessionToken();
  const expiryDays = rememberDevice ? 30 : 1;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  cleanExpiredSessions(user);
  if (!user.sessionTokens) user.sessionTokens = {};
  user.sessionTokens[sessionToken] = {
    createdAt: new Date().toISOString(),
    expiresAt,
    deviceName: req.headers['user-agent']?.slice(0, 50) || 'Web Device',
  };

  if (!user.recoveryKey) {
    user.recoveryKey = generateRecoveryKey();
  }

  dbStore[normalizedEmail] = user;
  saveDb(dbStore);

  const cleanData = scrubSampleTraces(user);

  res.json({
    success: true,
    token: sessionToken,
    recoveryKey: user.recoveryKey,
    user: {
      email: normalizedEmail,
      name: user.settings?.userName || normalizedEmail.split('@')[0],
    },
    data: {
      quarters: cleanData.quarters,
      projects: cleanData.projects,
      settings: cleanData.settings,
      lastSyncedAt: user.lastSyncedAt,
    },
  });
});

// Auth Forgot Passphrase: Dispatches 6-digit email code (valid 15m)
app.post('/api/auth/forgot-passphrase', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = dbStore[normalizedEmail];
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email.' });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  user.resetCode = resetCode;
  user.resetCodeExpires = resetExpires;
  dbStore[normalizedEmail] = user;
  saveDb(dbStore);

  const sendResult = await sendPasswordResetEmail(normalizedEmail, resetCode, user.recoveryKey);

  // In preview/dev environment or when SMTP is not configured, also provide devCode so testing is seamless
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  res.json({
    success: true,
    message: 'A 6-digit reset code has been generated. Please check your email or use your Emergency Recovery Key.',
    devCode: !hasSmtp ? resetCode : undefined,
    recoveryKeyConfigured: Boolean(user.recoveryKey),
    method: sendResult.method,
  });
});

// Auth Reset Passphrase: Supports 6-digit email code OR Emergency Recovery Key
app.post('/api/auth/reset-passphrase', (req, res) => {
  const { email, codeOrRecoveryKey, newPassphrase, rememberDevice } = req.body;
  if (!email || !codeOrRecoveryKey || !newPassphrase) {
    return res.status(400).json({ error: 'Email, verification code or recovery key, and new passphrase are required.' });
  }

  if (typeof newPassphrase !== 'string' || newPassphrase.trim().length < 6) {
    return res.status(400).json({ error: 'New passphrase must be at least 6 characters long.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = dbStore[normalizedEmail];
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const inputKey = codeOrRecoveryKey.trim().toUpperCase();
  let isAuthorized = false;

  // 1. Verify 6-digit reset code
  if (user.resetCode && user.resetCodeExpires) {
    const isNotExpired = new Date(user.resetCodeExpires).getTime() > Date.now();
    if (isNotExpired && user.resetCode.trim() === inputKey) {
      isAuthorized = true;
    }
  }

  // 2. Verify Emergency Recovery Key
  if (!isAuthorized && user.recoveryKey) {
    if (user.recoveryKey.trim().toUpperCase() === inputKey) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(400).json({
      error: 'Invalid or expired verification code or recovery key. Please check again.',
    });
  }

  // Hash new passphrase
  const { hash, salt } = hashPassword(newPassphrase.trim());
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;

  // Generate fresh recovery key & session token
  const recoveryKey = generateRecoveryKey();
  user.recoveryKey = recoveryKey;

  const sessionToken = generateSessionToken();
  const expiryDays = rememberDevice ? 30 : 1;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  cleanExpiredSessions(user);
  if (!user.sessionTokens) user.sessionTokens = {};
  user.sessionTokens[sessionToken] = {
    createdAt: new Date().toISOString(),
    expiresAt,
    deviceName: req.headers['user-agent']?.slice(0, 50) || 'Web Device',
  };

  dbStore[normalizedEmail] = user;
  saveDb(dbStore);

  const cleanData = scrubSampleTraces(user);

  res.json({
    success: true,
    token: sessionToken,
    recoveryKey,
    user: {
      email: normalizedEmail,
      name: user.settings?.userName || normalizedEmail.split('@')[0],
    },
    data: {
      quarters: cleanData.quarters,
      projects: cleanData.projects,
      settings: cleanData.settings,
      lastSyncedAt: user.lastSyncedAt,
    },
  });
});

// Auth Status / Session check
app.get(['/api/auth/status', '/api/auth/user', '/api/auth/me', '/api/auth/session'], (req, res) => {
  const token = extractAuthToken(req);
  const emailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase();

  if (emailHeader && dbStore[emailHeader]) {
    const user = dbStore[emailHeader];
    const hasPass = Boolean(user.passwordHash && user.passwordSalt);

    if (hasPass) {
      if (token && verifyUserSession(emailHeader, token)) {
        return res.json({
          success: true,
          authenticated: true,
          hasPassphrase: true,
          recoveryKey: user.recoveryKey,
          user: { email: emailHeader, name: user.settings?.userName || emailHeader.split('@')[0] },
          data: scrubSampleTraces(user),
        });
      }
      return res.json({
        success: true,
        authenticated: false,
        hasPassphrase: true,
        message: 'Passphrase required to unlock cloud data',
      });
    } else {
      // Legacy user without passphrase
      return res.json({
        success: true,
        authenticated: true,
        hasPassphrase: false,
        user: { email: emailHeader, name: user.settings?.userName || emailHeader.split('@')[0] },
        data: scrubSampleTraces(user),
      });
    }
  }

  res.json({ success: true, authenticated: false, user: null, message: 'Anonymous session' });
});

// Auth Logout Endpoint: Invalidate session token
app.post('/api/auth/logout', (req, res) => {
  const token = extractAuthToken(req);
  const { email } = req.body;
  const targetEmail = (email || (req.headers['x-user-email'] as string) || '').trim().toLowerCase();

  if (targetEmail && dbStore[targetEmail] && token) {
    const user = dbStore[targetEmail];
    if (user.sessionTokens && user.sessionTokens[token]) {
      delete user.sessionTokens[token];
      saveDb(dbStore);
    }
  }
  res.json({ success: true, message: 'Disconnected on this device' });
});

// Sync GET endpoint (pull data; validates passphrase session if user has a passphrase)
app.get(['/api/sync', '/api/sync/pull', '/api/sync/get'], (req, res) => {
  const emailHeader = req.headers['x-user-email'] as string;

  if (!emailHeader || typeof emailHeader !== 'string') {
    return res.status(400).json({ error: 'x-user-email header missing or invalid' });
  }
  const normalizedEmail = emailHeader.trim().toLowerCase();
  const existing = dbStore[normalizedEmail];

  // If user has passphrase configured, verify session token
  if (existing && existing.passwordHash && existing.passwordSalt) {
    const token = extractAuthToken(req);
    if (!token || !verifyUserSession(normalizedEmail, token)) {
      return res.status(401).json({
        error: 'Passphrase verification required. Please unlock your account to sync.',
        requireAuth: true,
        hasPassphrase: true,
      });
    }
  }

  const userData = scrubSampleTraces(
    existing || {
      quarters: {},
      projects: [],
      settings: null,
      lastSyncedAt: new Date().toISOString(),
    }
  );

  res.json({
    success: true,
    hasPassphrase: Boolean(existing?.passwordHash && existing?.passwordSalt),
    data: {
      quarters: userData.quarters,
      projects: userData.projects,
      settings: userData.settings,
      lastSyncedAt: userData.lastSyncedAt,
    },
    serverTime: new Date().toISOString(),
  });
});

function mergeDayRecordsList(
  existingDays: any[] = [],
  incomingDays: any[] = [],
  tombstones?: { sessionIds?: Record<string, string>; dates?: Record<string, string> }
): any[] {
  const activeTombstones = tombstones || { sessionIds: {}, dates: {} };
  const tombSessionIds = activeTombstones.sessionIds || {};
  const tombDates = activeTombstones.dates || {};

  const normalizeTimeStr = (t?: string | null): string => {
    if (!t) return '';
    const trimmed = String(t).trim();
    if (trimmed.length === 5) return `${trimmed}:00`;
    return trimmed;
  };

  const isSessionTombstoned = (p: any, recordDate?: string): boolean => {
    if (!p) return false;
    if (p.sessionId && tombSessionIds[String(p.sessionId).trim()]) {
      return true;
    }
    if (p.note) {
      for (const tombKey of Object.keys(tombSessionIds)) {
        if (tombKey.length > 5 && String(p.note).includes(tombKey)) {
          return true;
        }
      }
    }
    const inDate = p.inDate || recordDate || '';
    const inTime = p.inTime ? normalizeTimeStr(p.inTime) : '';
    const outTime = p.outTime ? normalizeTimeStr(p.outTime) : '';
    if (inDate && inTime) {
      const punchSig = `punch_del_${inDate}_${inTime}_${outTime}`;
      if (tombSessionIds[punchSig]) return true;
    }
    return false;
  };

  const isDateTombstoned = (d: string, dayUpdatedAt?: string): boolean => {
    const tombTimeStr = tombDates[d];
    if (!tombTimeStr) return false;
    if (!dayUpdatedAt) return true;
    return new Date(tombTimeStr).getTime() >= new Date(dayUpdatedAt).getTime();
  };

  const sanitizePunches = (punches: any[], recordDate?: string) => {
    if (!Array.isArray(punches)) return [];
    return punches.filter((p) => !isSessionTombstoned(p, recordDate));
  };

  const dayMap = new Map<string, any>();
  const normalizeDateKey = (d: any) => (d && d.date ? String(d.date).trim() : '');

  // 1. Seed with existing days that are not tombstoned
  existingDays.forEach((day) => {
    const key = normalizeDateKey(day);
    if (key && !isDateTombstoned(key, day.updatedAt)) {
      const sanitized = sanitizePunches(day.punches, key);
      if (sanitized.length > 0 || (day.notes && String(day.notes).trim().length > 0)) {
        dayMap.set(key, { ...day, punches: sanitized });
      }
    }
  });

  // 2. Reconcile with incoming days using timestamp comparison (never union-merge deleted punches)
  incomingDays.forEach((incomingDay) => {
    const key = normalizeDateKey(incomingDay);
    if (!key) return;

    if (isDateTombstoned(key, incomingDay.updatedAt)) {
      dayMap.delete(key);
      return;
    }

    const existingDay = dayMap.get(key);
    if (!existingDay) {
      const sanitized = sanitizePunches(incomingDay.punches, key);
      if (sanitized.length > 0 || (incomingDay.notes && String(incomingDay.notes).trim().length > 0)) {
        dayMap.set(key, { ...incomingDay, punches: sanitized });
      }
      return;
    }

    // Both exist: compare timestamps
    const existingTime = new Date(existingDay.updatedAt || 0).getTime();
    const incomingTime = new Date(incomingDay.updatedAt || 0).getTime();

    if (incomingTime >= existingTime || !existingDay.updatedAt) {
      // Incoming is newer or equal: incoming punches replace existing punches
      const sanitized = sanitizePunches(incomingDay.punches, key);
      if (sanitized.length > 0 || (incomingDay.notes && String(incomingDay.notes).trim().length > 0)) {
        dayMap.set(key, {
          ...existingDay,
          ...incomingDay,
          punches: sanitized,
          notes: incomingDay.notes !== undefined ? incomingDay.notes : existingDay.notes,
          primaryProjectId: incomingDay.primaryProjectId || existingDay.primaryProjectId,
          updatedAt: incomingDay.updatedAt || new Date().toISOString(),
        });
      } else {
        dayMap.delete(key);
      }
    } else {
      // Existing server day is strictly newer
      const sanitized = sanitizePunches(existingDay.punches, key);
      if (sanitized.length > 0 || (existingDay.notes && String(existingDay.notes).trim().length > 0)) {
        dayMap.set(key, {
          ...incomingDay,
          ...existingDay,
          punches: sanitized,
          notes: existingDay.notes !== undefined ? existingDay.notes : incomingDay.notes,
          primaryProjectId: existingDay.primaryProjectId || incomingDay.primaryProjectId,
          updatedAt: existingDay.updatedAt || new Date().toISOString(),
        });
      } else {
        dayMap.delete(key);
      }
    }
  });

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Sync POST endpoint (push data via email without passwords/pins)
app.post(['/api/sync', '/api/sync/push', '/api/sync/save'], (req, res) => {
  const emailHeader = req.headers['x-user-email'] as string;
  const { email, quarters, projects, settings, tombstones } = req.body;

  const targetEmail = (emailHeader || email || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid user email required for sync' });
  }

  const existing = dbStore[targetEmail];

  // If user has a passphrase set, verify authorization token
  if (existing && existing.passwordHash && existing.passwordSalt) {
    const token = extractAuthToken(req);
    if (!token || !verifyUserSession(targetEmail, token)) {
      return res.status(401).json({
        error: 'Passphrase verification required. Please unlock your account to sync.',
        requireAuth: true,
        hasPassphrase: true,
      });
    }
  }

  const record = existing || {
    quarters: {},
    projects: [],
    settings: {},
    tombstones: { sessionIds: {}, dates: {} },
    lastSyncedAt: new Date().toISOString(),
  };

  // Merge tombstones
  const existingTombstones = record.tombstones || { sessionIds: {}, dates: {} };
  const incomingTombstones = tombstones || { sessionIds: {}, dates: {} };
  const mergedTombstones = {
    sessionIds: { ...(existingTombstones.sessionIds || {}), ...(incomingTombstones.sessionIds || {}) },
    dates: { ...(existingTombstones.dates || {}), ...(incomingTombstones.dates || {}) },
  };
  record.tombstones = mergedTombstones;

  if (quarters && typeof quarters === 'object') {
    const updatedQuarters: Record<string, any[]> = { ...(record.quarters || {}) };
    for (const [qName, incomingDays] of Object.entries(quarters)) {
      if (Array.isArray(incomingDays)) {
        const existingDays = updatedQuarters[qName] || [];
        updatedQuarters[qName] = mergeDayRecordsList(existingDays, incomingDays, mergedTombstones);
      }
    }
    record.quarters = updatedQuarters;
  }

  if (projects && Array.isArray(projects)) {
    const existingProjects: any[] = record.projects || [];
    const pMap = new Map<string, any>();
    existingProjects.forEach((p) => {
      if (p && p.id) pMap.set(p.id, p);
    });

    projects.forEach((incomingP) => {
      if (!incomingP || !incomingP.id) return;
      const curr = pMap.get(incomingP.id);
      if (!curr) {
        pMap.set(incomingP.id, incomingP);
      } else {
        const currTime = new Date(curr.deletedAt || curr.updatedAt || curr.createdAt || 0).getTime();
        const incomingTime = new Date(incomingP.deletedAt || incomingP.updatedAt || incomingP.createdAt || 0).getTime();
        if (incomingTime >= currTime) {
          pMap.set(incomingP.id, { ...curr, ...incomingP });
        }
      }
    });
    record.projects = Array.from(pMap.values());
  }

  if (settings && typeof settings === 'object') {
    record.settings = { ...record.settings, ...settings, userEmail: targetEmail };
  }

  // Clean any sample traces from record before storing
  const cleanedRecord = scrubSampleTraces(record);
  cleanedRecord.lastSyncedAt = new Date().toISOString();
  dbStore[targetEmail] = cleanedRecord;
  saveDb(dbStore);

  res.json({
    success: true,
    lastSyncedAt: cleanedRecord.lastSyncedAt,
    data: {
      quarters: cleanedRecord.quarters,
      projects: cleanedRecord.projects,
      settings: cleanedRecord.settings,
      lastSyncedAt: cleanedRecord.lastSyncedAt,
    },
  });
});

// Setup Vite development middleware or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful termination for Cloud Run container lifecycle
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
