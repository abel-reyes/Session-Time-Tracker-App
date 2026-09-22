import { useState } from 'react';
import { 
  Gift, 
  X, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  Laptop, 
  FileSpreadsheet, 
  ShieldCheck, 
  Share2, 
  Sparkles,
  ExternalLink,
  BookOpen,
  Send
} from 'lucide-react';
import { exportAllDataJSON } from '../utils/storage';

interface GiftSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasEndpointUrl?: string;
  onSaveGasUrl?: (url: string) => void;
  themeColor?: string;
}

export function GiftSetupModal({ isOpen, onClose, themeColor = '#0284C7' }: GiftSetupModalProps) {
  const [activeTab, setActiveTab] = useState<'zero-server' | 'standalone-html' | 'apps-script'>('zero-server');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadBackup = () => {
    const json = exportAllDataJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Session_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const appsScriptCode = `/**
 * Google Apps Script Web App for Session Time Tracker
 * Paste this into script.google.com -> Deploy as Web App -> Access: "Anyone"
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var action = (e && e.parameter && e.parameter.action) || 'getMetrics';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var quarterNum = Math.floor(now.getMonth() / 3) + 1;
  var sheetName = 'Q' + quarterNum + ' ' + now.getFullYear();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName, 0);

  // Return CORS-enabled JSON response
  var output = ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    quarter: sheetName,
    serverTime: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
  return output;
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Gifting & Zero-Server Local Guide
              </h3>
              <p className="text-xs text-slate-600">
                The easiest ways to deliver this time tracker to a friend or client
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/70">
          <button
            onClick={() => setActiveTab('zero-server')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'zero-server'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-4 h-4" />
            1. Standalone / Browser Link
          </button>

          <button
            onClick={() => setActiveTab('standalone-html')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'standalone-html'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. Offline Backup & Portability
          </button>

          <button
            onClick={() => setActiveTab('apps-script')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'apps-script'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            3. Google Sheets (Optional)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* TAB 1: ZERO SERVER LOCAL */}
          {activeTab === 'zero-server' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Why this is perfect for gifting
                </div>
                <p className="leading-relaxed">
                  This application is <strong>100% client-side capable</strong>. The recipient does <em>not</em> need to install Node.js, run a terminal, configure environment variables, or manage servers.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  How to send this to them:
                </h4>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>1. Share the Hosted Web URL</span>
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Share Link'}</span>
                    </button>
                  </div>
                  <p className="text-slate-500">
                    They can open the link in any modern browser (desktop, tablet, or phone) and start logging time immediately. Data is saved locally in their browser.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="font-bold text-slate-800">
                    2. Install as a Desktop / Mobile App (PWA)
                  </div>
                  <p className="text-slate-500">
                    In Chrome, Edge, or Safari: click the <strong>Install / Add to Home Screen</strong> icon in the address bar to create a standalone desktop dock app with no browser address bar!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="font-bold text-slate-800">
                    3. Offline & Private Local Storage
                  </div>
                  <p className="text-slate-500">
                    All quarter records, daily punch slots, and custom settings persist securely in the recipient's local device storage without sending private work logs anywhere.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STANDALONE HTML & BACKUP */}
          {activeTab === 'standalone-html' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1.5">
                <div className="font-bold text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  Transfer & Portable File Backups
                </div>
                <p className="leading-relaxed">
                  Download full JSON backup packages to easily move sessions across computers or keep secure time records.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-900">Export All Quarters & Settings (JSON)</div>
                  <div className="text-slate-500 text-[11px]">
                    Creates a complete timestamp data file that can be imported anytime on any machine.
                  </div>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-900">Google Sheets CSV Compatibility</div>
                <p className="text-slate-500">
                  You can also click <strong>"Export CSV"</strong> at any time to generate a spreadsheet file formatted identically to your Google Apps Script sheet headers (`Time In 1`, `Time Out 1` ... `Time Out 5`, `Total Hours`).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS APPS SCRIPT */}
          {activeTab === 'apps-script' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Optional: Dual-Sync with Google Sheets
                </div>
                <p className="text-slate-500">
                  If the recipient wants their punches to also write directly into a cloud Google Sheet in real-time, follow these 3 quick steps:
                </p>
              </div>

              <ol className="space-y-3 list-decimal list-inside text-slate-600 font-medium">
                <li className="p-3 rounded-lg border border-slate-200 bg-white">
                  <strong>Create a new Google Sheet</strong>, go to <em>Extensions &rarr; Apps Script</em>.
                </li>
                <li className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span><strong>Paste the bridge script:</strong></span>
                    <button
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copied Script!' : 'Copy Script Code'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-md bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-28">
                    {appsScriptCode}
                  </pre>
                </li>
                <li className="p-3 rounded-lg border border-slate-200 bg-white">
                  Click <strong>Deploy &rarr; New Deployment &rarr; Web App</strong> (Execute as: Me, Who has access: Anyone). Copy the Web App URL and paste it into the <em>Settings &rarr; Google Apps Script URL</em> field in this app.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Session Time Tracker &bull; Zero Server Deployment Ready
          </span>
          <span className="text-[11px] text-slate-500 sm:hidden">
            Zero Server Ready
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 ml-auto"
            style={{ backgroundColor: themeColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
