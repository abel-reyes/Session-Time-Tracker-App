import { useState } from 'react';
import { 
  Gift, 
  X, 
  Copy, 
  Check, 
  Sparkles, 
  Share2, 
  FolderPlus, 
  Target, 
  ShieldCheck, 
  RotateCcw,
  ExternalLink,
  Download
} from 'lucide-react';
import { AppSettings } from '../types';
import { clearAllLocalData, saveSettings, saveProjects } from '../utils/storage';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  onApplyGiftConfig: (newTitle: string) => void;
  themeColor?: string;
}

export function GiftModal({
  isOpen,
  onClose,
  currentSettings,
  onApplyGiftConfig,
  themeColor = '#0284C7',
}: GiftModalProps) {
  const [giftTitle, setGiftTitle] = useState<string>(currentSettings.appTitle || 'Session Time Tracker');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const giftUrl = `${currentUrl}?title=${encodeURIComponent(giftTitle.trim() || 'Session Time Tracker')}&blank=true`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(giftUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadGiftConfig = () => {
    const blankConfig = {
      appTitle: giftTitle.trim() || 'Session Time Tracker',
      version: '2.0.0',
      giftedAt: new Date().toISOString(),
      projects: [],
      goals: null,
      settings: {
        appTitle: giftTitle.trim() || 'Session Time Tracker',
        enableGoals: false,
        enableProjects: true,
        enableStreaks: false,
        weeklyGoalHours: 0,
        dailyGoalHours: 0,
        soundEnabled: true,
      }
    };
    const blob = new Blob([JSON.stringify(blankConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(giftTitle.trim() || 'tracker').toLowerCase().replace(/\s+/g, '-')}-blank-slate.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetToBlankSlate = () => {
    setConfirmDialog({
      title: 'Reset to Blank Slate Tracker?',
      message: `This will wipe all existing data on this browser and configure the tracker with the title "${giftTitle.trim() || 'Session Time Tracker'}". Continue?`,
      confirmText: 'Reset to Blank Slate',
      variant: 'danger',
      onConfirm: () => {
        clearAllLocalData();
        const newSettings: AppSettings = {
          ...currentSettings,
          appTitle: giftTitle.trim() || 'Session Time Tracker',
          enableGoals: false,
          weeklyGoalHours: 0,
          dailyGoalHours: 0,
          userName: '',
          userEmail: '',
        };
        saveSettings(newSettings);
        saveProjects([]);
        onApplyGiftConfig(giftTitle.trim() || 'Session Time Tracker');
        setResetSuccess(true);
        setTimeout(() => {
          setResetSuccess(false);
          onClose();
          window.location.reload();
        }, 1000);
      },
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gift a Blank Slate Tracker</h3>
              <p className="text-xs text-slate-500">Share a clean, custom-labeled time tracker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
          {/* Custom Labeling */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Recipient App Title / Label
            </label>
            <p className="text-[11px] text-slate-500">
              Personalize what the application is named for the recipient (e.g., "Sarah's Consulting Tracker", "Client Work Hub", or "Alex's Dev Log").
            </p>
            <input
              type="text"
              value={giftTitle}
              onChange={(e) => setGiftTitle(e.target.value)}
              placeholder="e.g. Acme Studio Time Tracker"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:outline-slate-900 transition-colors"
            />
          </div>

          {/* Shareable Link Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Shareable Gift Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={giftUrl}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-mono truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer shadow-2xs"
                style={{ backgroundColor: themeColor }}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              When opened, the app will instantly launch configured with your custom label in a fresh blank slate.
            </p>
          </div>

          {/* Actions & Export */}
          <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleDownloadGiftConfig}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Gift JSON</span>
            </button>

            <button
              type="button"
              onClick={handleResetToBlankSlate}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              title="Reset current device to this blank slate"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{resetSuccess ? 'Reset Complete!' : 'Apply Blank Slate Here'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Recipients can also sign in via email to sync cross-device.
          </span>
          <span className="text-[11px] text-slate-500 sm:hidden">
            Cross-device sync enabled.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 ml-auto"
            style={{ backgroundColor: themeColor }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={themeColor}
      />
    </div>
  );
}
