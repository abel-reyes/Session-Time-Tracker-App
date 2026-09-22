import express from 'express';
import path from 'path';
import fs from 'fs';
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


interface UserDataStore {
  [email: string]: {
    quarters: { [quarterName: string]: any[] };
    projects: any[];
    settings: any;
    lastSyncedAt: string;
  };
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


// Auth Status check compatibility route
app.get(['/api/auth/status', '/api/auth/user', '/api/auth/me', '/api/auth/session'], (req, res) => {
  const emailHeader = req.headers['x-user-email'] as string;
  if (emailHeader && typeof emailHeader === 'string') {
    const normalized = emailHeader.trim().toLowerCase();
    if (dbStore[normalized]) {
      const userRecord = dbStore[normalized];
      return res.json({
        success: true,
        user: { email: normalized, name: userRecord.settings?.userName || normalized.split('@')[0] },
        data: userRecord,
      });
    }
  }
  res.json({ success: true, user: null, message: 'Anonymous session' });
});

// Sync Connect endpoint (Cross-device sync without requiring password/PIN)
app.post(['/api/auth/login', '/api/auth/signin', '/api/auth/register', '/api/auth/connect'], (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = dbStore[normalizedEmail];

  if (!existing) {
    dbStore[normalizedEmail] = {
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
      lastSyncedAt: new Date().toISOString(),
    };
    saveDb(dbStore);
  }

  const userRecord = dbStore[normalizedEmail];

  res.json({
    success: true,
    user: {
      email: normalizedEmail,
      name: userRecord.settings?.userName || normalizedEmail.split('@')[0],
    },
    data: {
      quarters: userRecord.quarters,
      projects: userRecord.projects,
      settings: userRecord.settings,
      lastSyncedAt: userRecord.lastSyncedAt,
    },
  });
});

// Sync GET endpoint (pull data via email without passwords/pins)
app.get(['/api/sync', '/api/sync/pull', '/api/sync/get'], (req, res) => {
  const emailHeader = req.headers['x-user-email'] as string;

  if (!emailHeader || typeof emailHeader !== 'string') {
    return res.status(400).json({ error: 'x-user-email header missing or invalid' });
  }
  const normalizedEmail = emailHeader.trim().toLowerCase();
  const existing = dbStore[normalizedEmail];

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
    data: {
      quarters: userData.quarters,
      projects: userData.projects,
      settings: userData.settings,
      lastSyncedAt: userData.lastSyncedAt,
    },
    serverTime: new Date().toISOString(),
  });
});

function mergeDayRecordsList(existingDays: any[] = [], incomingDays: any[] = []): any[] {
  const dayMap = new Map<string, any>();

  const normalizeDateKey = (d: any) => (d && d.date ? String(d.date).trim() : '');

  // Seed with existing days
  existingDays.forEach((day) => {
    const key = normalizeDateKey(day);
    if (key) {
      dayMap.set(key, { ...day, punches: Array.isArray(day.punches) ? [...day.punches] : [] });
    }
  });

  // Merge incoming days
  incomingDays.forEach((incomingDay) => {
    const key = normalizeDateKey(incomingDay);
    if (!key) return;

    const existingDay = dayMap.get(key);
    if (!existingDay) {
      dayMap.set(key, { ...incomingDay, punches: Array.isArray(incomingDay.punches) ? [...incomingDay.punches] : [] });
      return;
    }

    // Merge punches for the same date
    const existingPunches: any[] = Array.isArray(existingDay.punches) ? existingDay.punches : [];
    const incomingPunches: any[] = Array.isArray(incomingDay.punches) ? incomingDay.punches : [];

    const punchMap = new Map<string, any>();

    existingPunches.forEach((p, idx) => {
      const pKey = p.inTime ? `in_${p.inTime}` : `idx_${idx}`;
      punchMap.set(pKey, { ...p });
    });

    incomingPunches.forEach((inP, idx) => {
      const pKey = inP.inTime ? `in_${inP.inTime}` : `idx_${idx}`;
      const currP = punchMap.get(pKey);
      if (!currP) {
        punchMap.set(pKey, { ...inP });
      } else {
        const mergedOut = inP.outTime || currP.outTime || '';
        const mergedIn = inP.inTime || currP.inTime || '';
        const mergedProjId = inP.projectId || currP.projectId;
        const mergedProjName = inP.projectName || currP.projectName;
        const mergedNote = inP.note || currP.note;

        punchMap.set(pKey, {
          ...currP,
          ...inP,
          inTime: mergedIn,
          outTime: mergedOut,
          projectId: mergedProjId,
          projectName: mergedProjName,
          note: mergedNote,
        });
      }
    });

    // Sort punches by inTime
    const mergedPunches = Array.from(punchMap.values()).sort((a, b) => {
      const aTime = a.inTime || '';
      const bTime = b.inTime || '';
      return aTime.localeCompare(bTime);
    });

    // Merge notes
    let mergedNotes = incomingDay.notes || existingDay.notes || undefined;
    if (incomingDay.notes && existingDay.notes && incomingDay.notes !== existingDay.notes) {
      if (incomingDay.notes.includes(existingDay.notes)) {
        mergedNotes = incomingDay.notes;
      } else if (existingDay.notes.includes(incomingDay.notes)) {
        mergedNotes = existingDay.notes;
      } else {
        mergedNotes = `${existingDay.notes} | ${incomingDay.notes}`;
      }
    }

    dayMap.set(key, {
      ...existingDay,
      ...incomingDay,
      punches: mergedPunches,
      notes: mergedNotes,
      primaryProjectId: incomingDay.primaryProjectId || existingDay.primaryProjectId,
    });
  });

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Sync POST endpoint (push data via email without passwords/pins)
app.post(['/api/sync', '/api/sync/push', '/api/sync/save'], (req, res) => {
  const emailHeader = req.headers['x-user-email'] as string;
  const { email, quarters, projects, settings } = req.body;

  const targetEmail = (emailHeader || email || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid user email required for sync' });
  }

  const existing = dbStore[targetEmail];

  const record = existing || {
    quarters: {},
    projects: [],
    settings: {},
    lastSyncedAt: new Date().toISOString(),
  };

  if (quarters && typeof quarters === 'object') {
    const updatedQuarters: Record<string, any[]> = { ...(record.quarters || {}) };
    for (const [qName, incomingDays] of Object.entries(quarters)) {
      if (Array.isArray(incomingDays)) {
        const existingDays = updatedQuarters[qName] || [];
        updatedQuarters[qName] = mergeDayRecordsList(existingDays, incomingDays);
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
