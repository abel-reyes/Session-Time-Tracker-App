import { useState, useEffect, FormEvent } from 'react';
import { 
  Settings, 
  X, 
  Volume2, 
  RotateCcw, 
  Check, 
  Target, 
  Clock, 
  Link, 
  Trash2,
  Sparkles,
  Sliders,
  Palette,
  Pipette,
  Type,
  BarChart2,
  Gift,
  Copy,
  Share2,
  ChevronDown,
  ChevronUp,
  Users,
  Send,
  Sparkle,
  Smartphone,
  Download,
  MessageSquarePlus,
  Mail,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  FileText,
  Filter,
  CheckCircle2,
  ClipboardCopy,
  Edit3,
  Save,
  SendHorizontal
} from 'lucide-react';
import { AppSettings, TextSizeOption, SuggestionTicket, SuggestionStatus } from '../types';
import { 
  clearAllLocalData, 
  seedSampleData, 
  saveQuarterData,
  fetchGlobalStats,
  recordGiftSent,
  AppUsageStats,
  isCreator,
  isPreviewEnv,
  isSampleDataActive,
  setSampleDataActive,
  clearSampleData,
  SAMPLE_PROJECTS,
  saveProjects,
  loadProjects,
  submitSuggestion,
  fetchCreatorSuggestions,
  updateCreatorSuggestionStatus,
  deleteCreatorSuggestion,
  exportSuggestionsToMarkdownFile,
  CREATOR_EMAIL
} from '../utils/storage';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { EmptyState } from './EmptyState';
import {
  formatSuggestionEmailBody,
  formatTicketAsMarkdown,
  getGmailComposeUrl,
  openSuggestionInEmail
} from '../utils/gmail';

import { APP_VERSION } from '../version';
import { getQuarterName } from '../utils/timeCalculations';

export const TEXT_SIZE_OPTIONS: {
  id: TextSizeOption;
  label: string;
  step: number;
  scalePercent: string;
  description: string;
}[] = [
  { id: 'default', label: 'Default', step: 0, scalePercent: '100%', description: 'Standard baseline scale' },
  { id: 'large', label: 'Large (+1)', step: 1, scalePercent: '110%', description: 'Comfortable reading' },
  { id: 'larger', label: 'Larger (+2)', step: 2, scalePercent: '120%', description: 'High visibility & contrast' },
  { id: 'largest', label: 'Largest (+3)', step: 3, scalePercent: '130%', description: 'Maximum accessibility scale' },
];

export const THEME_COLOR_WAYS = [
  // Row 1: Ocean, Forest, Berry, Dukes, Eclipse
  { name: 'Ocean', hex: '#0284C7', secondaryHex: '#0F172A' },
  { name: 'Forest', hex: '#15803D', secondaryHex: '#451A03' },
  { name: 'Berry', hex: '#8B5CF6', secondaryHex: '#10B981' },
  { name: 'Dukes', hex: '#450084', secondaryHex: '#CBB677' },
  { name: 'Eclipse', hex: '#D97706', secondaryHex: '#1E1B4B' },
  // Row 2: Sumac, Sunset, Copper, Cobalt, Midnight
  { name: 'Sumac', hex: '#D65467', secondaryHex: '#38511D' },
  { name: 'Sunset', hex: '#D44B2E', secondaryHex: '#4A2E35' },
  { name: 'Copper', hex: '#C2410C', secondaryHex: '#0D9488' },
  { name: 'Cobalt', hex: '#1D4ED8', secondaryHex: '#431407' },
  { name: 'Midnight', hex: '#0F172A', secondaryHex: '#EAB308' },
];

type SettingsTab = 'theme' | 'goals' | 'cloud' | 'gift' | 'suggestion' | 'inbox';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (updated: AppSettings) => void;
  onDataReload: () => void;
  onOpenGiftModal?: () => void;
  onOpenWidgetGuide?: () => void;
  onSyncRefresh?: () => void;
  initialTab?: SettingsTab;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onDataReload,
  onOpenGiftModal,
  onOpenWidgetGuide,
  onSyncRefresh,
  initialTab = 'theme',
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'theme');
  const [isCustomColorsOpen, setIsCustomColorsOpen] = useState<boolean>(false);
  const [isTextSizeOpen, setIsTextSizeOpen] = useState<boolean>(false);
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    themeColor: settings.themeColor || '#0284C7',
    chartColor: settings.chartColor || '#0F172A',
    textSize: settings.textSize || 'default',
    enableGoals: settings.enableGoals !== false,
  });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedGiftLink, setCopiedGiftLink] = useState<boolean>(false);
  const [syncChartWithTheme, setSyncChartWithTheme] = useState<boolean>(
    (settings.chartColor || '#0F172A') === (settings.themeColor || '#0284C7')
  );
  const [usageStats, setUsageStats] = useState<AppUsageStats>({
    totalUsers: 1,
    totalUniqueDevices: 1,
    totalSignedAccounts: 0,
    totalVisits: 1,
    totalGiftsSent: 0,
    totalGiftsClaimed: 0,
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [showPwaGuide, setShowPwaGuide] = useState<boolean>(false);
  const [isGasSectionOpen, setIsGasSectionOpen] = useState<boolean>(Boolean(settings.gasEndpointUrl));
  const [isPwaSectionOpen, setIsPwaSectionOpen] = useState<boolean>(false);
  const [isWidgetSectionOpen, setIsWidgetSectionOpen] = useState<boolean>(false);
  const [copiedWidgetUrl, setCopiedWidgetUrl] = useState<string | null>(null);

  // Goal Inputs (allow blank string or 0 for effortless editing)
  const [weeklyGoalInput, setWeeklyGoalInput] = useState<string>(
    settings.weeklyGoalHours !== undefined && settings.weeklyGoalHours !== null
      ? String(settings.weeklyGoalHours)
      : '40'
  );
  const [dailyGoalInput, setDailyGoalInput] = useState<string>(
    settings.dailyGoalHours !== undefined && settings.dailyGoalHours !== null
      ? String(settings.dailyGoalHours)
      : '8'
  );

  const [suggestionName, setSuggestionName] = useState<string>(settings.userName || '');
  const [suggestionEmail, setSuggestionEmail] = useState<string>(settings.userEmail || '');
  const [suggestionCategory, setSuggestionCategory] = useState<string>('Feature Request');
  const [suggestionMessage, setSuggestionMessage] = useState<string>('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState<boolean>(false);
  const [suggestionSuccessMessage, setSuggestionSuccessMessage] = useState<string | null>(null);
  const [suggestionErrorMessage, setSuggestionErrorMessage] = useState<string | null>(null);
  const [lastSubmittedPayload, setLastSubmittedPayload] = useState<{
    ticketId?: string;
    name: string;
    email: string;
    category: string;
    message: string;
  } | null>(null);
  const [isSampleActive, setIsSampleActive] = useState<boolean>(isSampleDataActive());

  // Creator Suggestion Inbox & Change Requests
  const [creatorSuggestionsList, setCreatorSuggestionsList] = useState<SuggestionTicket[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'new' | 'in_progress' | 'completed'>('all');
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [isTestingEmail, setIsTestingEmail] = useState<boolean>(false);
  const [gmailNotification, setGmailNotification] = useState<{ text: string; isError: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);


  useEffect(() => {
    if (isCreator(settings.userEmail)) {
      loadSuggestions();
    }
  }, [settings.userEmail]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowPwaGuide(true);
    }
  };

  const loadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const sugs = await fetchCreatorSuggestions();
      setCreatorSuggestionsList(sugs);
    } catch {
      // Ignore
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...settings,
        themeColor: settings.themeColor || '#0284C7',
        chartColor: settings.chartColor || '#0F172A',
        textSize: settings.textSize || 'default',
        enableGoals: settings.enableGoals !== false,
      });
      setWeeklyGoalInput(
        settings.weeklyGoalHours !== undefined && settings.weeklyGoalHours !== null
          ? String(settings.weeklyGoalHours)
          : '40'
      );
      setDailyGoalInput(
        settings.dailyGoalHours !== undefined && settings.dailyGoalHours !== null
          ? String(settings.dailyGoalHours)
          : '8'
      );
      setSyncChartWithTheme(
        (settings.chartColor || '#0F172A') === (settings.themeColor || '#0284C7')
      );
      setIsSampleActive(isSampleDataActive());
      fetchGlobalStats().then((stats) => {
        if (stats) setUsageStats(stats);
      });
      if (initialTab) {
        if (initialTab === 'inbox') {
          setActiveTab(isCreator(settings.userEmail) ? 'inbox' : 'general');
        } else {
          setActiveTab(initialTab);
        }
      }
      if (isCreator(settings.userEmail)) {
        loadSuggestions();
      }
    }
  }, [isOpen, settings, initialTab]);

  if (!isOpen) return null;

  const currentTheme = form.themeColor || '#0284C7';
  const currentChart = form.chartColor || '#0F172A';
  const currentTextSize = form.textSize || 'default';
  const currentTextSizeOption = TEXT_SIZE_OPTIONS.find((o) => o.id === currentTextSize) || TEXT_SIZE_OPTIONS[0];
  const currentTextSizeStep = currentTextSizeOption.step;

  const handleSelectPreset = (preset: typeof THEME_COLOR_WAYS[0]) => {
    setForm((prev) => ({
      ...prev,
      themeColor: preset.hex,
      chartColor: preset.secondaryHex || preset.hex,
    }));
  };

  const handleThemeColorChange = (newHex: string) => {
    setForm((prev) => ({
      ...prev,
      themeColor: newHex,
      chartColor: syncChartWithTheme ? newHex : prev.chartColor,
    }));
  };

  const handleChartColorChange = (newHex: string) => {
    setForm((prev) => ({
      ...prev,
      chartColor: newHex,
    }));
  };

  const handleSave = () => {
    const weeklyNum = weeklyGoalInput.trim() === '' ? 0 : Math.max(0, Number(weeklyGoalInput) || 0);
    const dailyNum = dailyGoalInput.trim() === '' ? 0 : Math.max(0, Number(dailyGoalInput) || 0);
    const updatedForm: AppSettings = {
      ...form,
      weeklyGoalHours: weeklyNum,
      dailyGoalHours: dailyNum,
    };
    onSaveSettings(updatedForm);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const handleResetSampleData = () => {
    setConfirmDialog({
      title: 'Seed Everyday Sample Sessions?',
      message: 'This will populate everyday across the entire quarter with realistic work sessions flagged as (sample) for full chart and week-over-week reference. If you already have clocked entries, sample sessions will be safely added alongside them.',
      confirmText: 'Seed Sample Data',
      variant: 'primary',
      onConfirm: () => {
        const currentQ = getQuarterName();
        seedSampleData(currentQ);
        setIsSampleActive(true);
        onDataReload();
      },
    });
  };

  const handleClearSampleData = () => {
    setConfirmDialog({
      title: 'Clear Sample Sessions?',
      message: 'ONLY sample sessions flagged with (sample) will be removed. Your real personal entries will remain completely intact.',
      confirmText: 'Clear Sample Data',
      variant: 'warning',
      onConfirm: () => {
        const currentQ = getQuarterName();
        clearSampleData(currentQ);
        setIsSampleActive(false);
        onDataReload();
      },
    });
  };

  const handleForwardSuggestionToGmail = (sug: SuggestionTicket) => {
    setForwardingId(sug.id);
    try {
      openSuggestionInEmail({
        id: sug.id,
        ticketId: sug.ticketId,
        name: sug.name,
        email: sug.email,
        category: sug.category,
        message: sug.message,
        createdAt: sug.createdAt,
        status: sug.status,
        creatorNotes: sug.creatorNotes,
      }, true);
      setGmailNotification({ text: `Opened pre-filled draft for Ticket ${sug.ticketId || ''} to ${CREATOR_EMAIL}!`, isError: false });
    } catch {
      setGmailNotification({ text: 'Could not open email client.', isError: true });
    } finally {
      setTimeout(() => setForwardingId(null), 500);
    }
  };

  const handleUpdateStatus = async (sugId: string, newStatus: SuggestionStatus) => {
    setCreatorSuggestionsList(prev => prev.map(s => s.id === sugId ? { ...s, status: newStatus } : s));
    await updateCreatorSuggestionStatus(sugId, newStatus);
  };

  const handleSaveNotes = async (sugId: string, notes: string) => {
    setCreatorSuggestionsList(prev => prev.map(s => s.id === sugId ? { ...s, creatorNotes: notes } : s));
    await updateCreatorSuggestionStatus(sugId, undefined as any, notes);
    setEditingNotesId(null);
  };

  const handleCopyTicketMarkdown = async (sug: SuggestionTicket) => {
    const md = formatTicketAsMarkdown(sug);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(md);
    }
    setCopiedTicketId(sug.id);
    setTimeout(() => setCopiedTicketId(null), 2000);
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setGmailNotification(null);
    try {
      const res = await fetch('/api/suggestions/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setGmailNotification({ text: `Direct notification delivered to ${CREATOR_EMAIL}!`, isError: false });
      } else if (data.needsActivation) {
        setGmailNotification({
          text: `⚠️ Action Required: FormSubmit sent a 1-time 'Activate Form' link to ${CREATOR_EMAIL}. Please check your Gmail (inbox or spam) and click 'Activate Form' once. After that, all tests and suggestions are delivered automatically!`,
          isError: true,
        });
      } else {
        setGmailNotification({ text: data.message || `Diagnostics: ${data.error || 'Check network'}`, isError: true });
      }
    } catch {
      setGmailNotification({ text: 'Could not reach diagnostics endpoint.', isError: true });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSubmitSuggestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!suggestionMessage.trim()) return;
    setIsSubmittingSuggestion(true);
    setSuggestionErrorMessage(null);
    setSuggestionSuccessMessage(null);

    const payload = {
      name: suggestionName.trim() || form.userName || 'Anonymous User',
      email: suggestionEmail.trim() || form.userEmail || '',
      category: suggestionCategory,
      message: suggestionMessage.trim(),
    };

    // Save to server-side creator queue & auto-route to email
    const res = await submitSuggestion(payload);

    setIsSubmittingSuggestion(false);
    if (res.success) {
      const ticketRef = res.ticketId ? ` (#${res.ticketId})` : '';
      if (res.needsActivation) {
        setSuggestionSuccessMessage(`Change request${ticketRef} recorded! ⚠️ 1-time activation link sent to ${CREATOR_EMAIL}. Please check your Gmail and click 'Activate Form' once to enable automatic email forwarding.`);
      } else {
        setSuggestionSuccessMessage(`Thank you! Your change request${ticketRef} has been recorded in the Creator Queue and routed directly to ${CREATOR_EMAIL}.`);
      }
      setLastSubmittedPayload({
        ticketId: res.ticketId,
        name: payload.name,
        email: payload.email,
        category: payload.category,
        message: payload.message,
      });
      setSuggestionMessage('');
      loadSuggestions();
    } else {
      setSuggestionErrorMessage(res.error || res.message || 'Failed to submit change request');
    }
  };


  const handleWipeAll = () => {
    setConfirmDialog({
      title: 'Wipe All Local Timestamps & Data?',
      message: 'WARNING: This will permanently delete all local clock history, project logs, custom settings, and session cache from this browser. This action cannot be undone.',
      confirmText: 'Wipe Everything',
      variant: 'danger',
      onConfirm: () => {
        clearAllLocalData();
        window.location.reload();
      },
    });
  };

  const handleQuickCopyGift = async () => {
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
      const giftUrl = `${currentUrl}?title=${encodeURIComponent(form.appTitle || 'Session Time Tracker')}&blank=true`;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(giftUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = giftUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      recordGiftSent();
      setUsageStats((prev) => ({ ...prev, totalGiftsSent: (prev?.totalGiftsSent || 0) + 1 }));
      setCopiedGiftLink(true);
      setTimeout(() => setCopiedGiftLink(false), 2500);
    } catch {
      setCopiedGiftLink(true);
      setTimeout(() => setCopiedGiftLink(false), 2500);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]">
        {/* Sticky Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
              style={{ backgroundColor: currentTheme }}
            >
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Settings</h3>
              <p className="text-[11px] text-slate-500 hidden sm:block">Personalize colors, labels, goals, and sync</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close without saving"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Tabs on Mobile & Desktop to prevent endless scrolling */}
        <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200 shrink-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'theme'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            style={activeTab === 'theme' ? { color: currentTheme } : undefined}
          >
            Appearance & Theme
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'goals'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            style={activeTab === 'goals' ? { color: currentTheme } : undefined}
          >
            Goals & Audio
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'cloud'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            style={activeTab === 'cloud' ? { color: currentTheme } : undefined}
          >
            Cloud & Sync
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gift')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'gift'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            style={activeTab === 'gift' ? { color: currentTheme } : undefined}
          >
            Gift & Data
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suggestion')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'suggestion'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            style={activeTab === 'suggestion' ? { color: currentTheme } : undefined}
          >
            <MessageSquarePlus className="w-3 h-3" />
            <span>Have Suggestion?</span>
          </button>

          {/* Dedicated Creator Inbox tab for the creator */}
          {isCreator(settings.userEmail) && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('inbox');
                loadSuggestions();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'inbox'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70'
              }`}
            >
              <Mail className="w-3 h-3" />
              <span>📬 Creator Inbox</span>
              {creatorSuggestionsList.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'inbox'
                    ? 'bg-white text-emerald-800'
                    : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {creatorSuggestionsList.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1">
          {/* TAB 1: THEME & APPEARANCE */}
          {activeTab === 'theme' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Application Labeling / Custom Title */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" style={{ color: currentTheme }} />
                  Application Title & Label
                </div>
                <p className="text-[11px] text-slate-500">
                  Customize the name of your time tracking application displayed in the header.
                </p>
                <input
                  type="text"
                  placeholder="Session Time Tracker"
                  value={form.appTitle || ''}
                  onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-slate-900 shadow-2xs"
                />
              </div>

              {/* Color Ways & Personalization */}
              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" style={{ color: currentTheme }} />
                    Button & UI Color Ways
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {currentTheme}
                  </span>
                </div>

                {/* Color Way Presets */}
                <div className="grid grid-cols-5 gap-1.5">
                  {THEME_COLOR_WAYS.map((c) => {
                    const isSelected = 
                      currentTheme.toLowerCase() === c.hex.toLowerCase() &&
                      (!c.secondaryHex || currentChart.toLowerCase() === c.secondaryHex.toLowerCase());
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleSelectPreset(c)}
                        className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-slate-800 bg-slate-50 shadow-2xs scale-105 ring-1 ring-slate-800/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                        title={`${c.name} (Primary: ${c.hex}, Secondary: ${c.secondaryHex})`}
                      >
                        <div className="relative flex items-center justify-center">
                          <span
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full shrink-0 shadow-2xs flex items-center justify-center text-white"
                            style={{ backgroundColor: c.hex }}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          {c.secondaryHex && (
                            <span 
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white shadow-2xs"
                              style={{ backgroundColor: c.secondaryHex }}
                              title={`Secondary: ${c.secondaryHex}`}
                            />
                          )}
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-medium text-slate-700 truncate w-full text-center">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Collapsible Custom Colors Section (Primary & Secondary) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setIsCustomColorsOpen(!isCustomColorsOpen)}
                    className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-slate-100/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Pipette className="w-3.5 h-3.5" style={{ color: currentTheme }} />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Custom Colors (Primary & Secondary)</span>
                        <p className="text-[10px] text-slate-500">Tap to pick custom hex codes or color wheels</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: currentTheme }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: currentChart }} />
                      </div>
                      {isCustomColorsOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isCustomColorsOpen && (
                    <div className="p-3 bg-white border-t border-slate-200 space-y-3 animate-fadeIn">
                      {/* Primary Color Picker */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">Primary Color (Buttons & UI)</span>
                          <span className="text-[10px] font-mono font-semibold text-slate-500">{currentTheme}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="custom-primary-color-wheel"
                            value={currentTheme.startsWith('#') ? currentTheme : '#059669'}
                            onChange={(e) => handleThemeColorChange(e.target.value)}
                            className="w-8 h-8 p-0.5 rounded-lg border border-slate-300 cursor-pointer bg-white"
                            title="Primary color wheel"
                          />
                          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                            <span className="text-slate-400 font-mono mr-1">#</span>
                            <input
                              type="text"
                              maxLength={7}
                              placeholder="059669"
                              value={currentTheme.replace(/^#/, '')}
                              onChange={(e) => {
                                const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
                                if (val.length <= 6) {
                                  handleThemeColorChange('#' + val);
                                }
                              }}
                              className="w-full text-xs font-mono font-bold text-slate-900 uppercase outline-none bg-transparent"
                            />
                          </div>
                          <div
                            className="w-8 h-8 rounded-lg border border-slate-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: currentTheme }}
                          />
                        </div>
                      </div>

                      {/* Secondary / Chart Color Picker */}
                      <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">Secondary Color (Charts & Accents)</span>
                          <label className="flex items-center gap-1 text-[10px] font-medium text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={syncChartWithTheme}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSyncChartWithTheme(checked);
                                if (checked) {
                                  handleChartColorChange(currentTheme);
                                }
                              }}
                              className="w-3 h-3 rounded-xs cursor-pointer"
                              style={{ accentColor: currentTheme }}
                            />
                            <span>Sync with Primary</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            disabled={syncChartWithTheme}
                            value={currentChart.startsWith('#') ? currentChart : '#cbb677'}
                            onChange={(e) => handleChartColorChange(e.target.value)}
                            className="w-8 h-8 p-0.5 rounded-lg border border-slate-300 cursor-pointer bg-white disabled:opacity-50"
                            title="Secondary / chart color wheel"
                          />
                          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                            <span className="text-slate-400 font-mono mr-1">#</span>
                            <input
                              type="text"
                              disabled={syncChartWithTheme}
                              maxLength={7}
                              placeholder="CBB677"
                              value={currentChart.replace(/^#/, '')}
                              onChange={(e) => {
                                const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
                                if (val.length <= 6) {
                                  handleChartColorChange('#' + val);
                                }
                              }}
                              className="w-full text-xs font-mono font-bold text-slate-900 uppercase outline-none bg-transparent disabled:opacity-50"
                            />
                          </div>
                          <div
                            className="w-8 h-8 rounded-lg border border-slate-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: currentChart }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Text Size & Readability Collapsible Section */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsTextSizeOpen(!isTextSizeOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" style={{ color: currentTheme }} />
                    <span className="text-xs font-bold text-slate-800">Text Size & Readability</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs transition-colors"
                      style={{ 
                        color: currentTheme, 
                        backgroundColor: `${currentTheme}12`,
                        borderColor: `${currentTheme}35` 
                      }}
                    >
                      {currentTextSizeOption.label} • {currentTextSizeOption.scalePercent}
                    </span>
                    {isTextSizeOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {isTextSizeOpen && (
                  <div className="p-3.5 bg-white border-t border-slate-200 space-y-3 animate-fadeIn">
                    <p className="text-[11px] text-slate-500">
                      Select your preferred text scaling size across all timestamps, reports, tables, and modal windows.
                    </p>

                    {/* Slider and Step Selector Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                      {/* Slider Header Indicators */}
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-0.5">
                        <span className="text-[11px] flex items-center gap-1">
                          <span className="text-xs">A</span>
                          <span>Default</span>
                        </span>
                        <span className="text-[11px] flex items-center gap-1 text-slate-700 font-extrabold">
                          <span>Largest (+3)</span>
                          <span className="text-base">A+</span>
                        </span>
                      </div>

                      {/* Range Input Slider with 4 discrete snap positions */}
                      <div className="relative px-0.5">
                        <input
                          type="range"
                          min={0}
                          max={3}
                          step={1}
                          value={currentTextSizeStep}
                          onChange={(e) => {
                            const stepVal = Number(e.target.value);
                            const selectedOpt = TEXT_SIZE_OPTIONS.find((o) => o.step === stepVal);
                            if (selectedOpt) {
                              setForm((prev) => ({ ...prev, textSize: selectedOpt.id }));
                            }
                          }}
                          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 focus:outline-none"
                          style={{ accentColor: currentTheme }}
                        />
                        
                        {/* Tick Mark Indicators */}
                        <div className="flex justify-between px-1 -mt-1 text-[10px] text-slate-400 select-none pointer-events-none">
                          <span>|</span>
                          <span>|</span>
                          <span>|</span>
                          <span>|</span>
                        </div>
                      </div>

                      {/* 4 Interactive Buttons for 1-click selection */}
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {TEXT_SIZE_OPTIONS.map((opt) => {
                          const isSelected = (form.textSize || 'default') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, textSize: opt.id }))}
                              className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? 'bg-white shadow-xs font-bold ring-2'
                                  : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600 hover:text-slate-900'
                              }`}
                              style={
                                isSelected
                                  ? {
                                      borderColor: currentTheme,
                                      color: currentTheme,
                                      boxShadow: `0 0 0 1px ${currentTheme}`,
                                    }
                                  : undefined
                              }
                            >
                              <span className="text-[10px] sm:text-[11px] font-bold truncate w-full">
                                {opt.label}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {opt.scalePercent}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Typography Preview */}
                      <div className="p-3 rounded-lg bg-white border border-slate-200/90 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <span>Live Size Preview</span>
                          <span className="text-slate-500 font-medium lowercase">{currentTextSizeOption.description}</span>
                        </div>
                        <div 
                          className="text-slate-800 font-medium transition-all"
                          style={{
                            fontSize:
                              form.textSize === 'largest'
                                ? '1.25rem'
                                : form.textSize === 'larger'
                                ? '1.15rem'
                                : form.textSize === 'large'
                                ? '1.05rem'
                                : '0.95rem',
                          }}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">09:15 AM – 05:30 PM</span>
                            <span 
                              className="px-2 py-0.5 rounded-md text-white font-mono text-[0.8em] font-bold"
                              style={{ backgroundColor: currentTheme }}
                            >
                              8h 15m
                            </span>
                            <span className="text-slate-600 text-[0.85em]">Sample session text</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GOALS & AUDIO */}
          {activeTab === 'goals' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Goals Settings Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" style={{ color: currentTheme }} />
                    Set Session Goals
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enableGoals}
                      onChange={(e) => setForm({ ...form, enableGoals: e.target.checked })}
                      className="w-4 h-4 rounded-sm cursor-pointer"
                      style={{ accentColor: currentTheme }}
                    />
                    <span className="text-xs font-semibold text-slate-700">Enable Goals</span>
                  </label>
                </div>

                {form.enableGoals ? (
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Weekly Goal (Hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="168"
                        step="0.5"
                        value={weeklyGoalInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWeeklyGoalInput(val);
                          const num = val.trim() === '' ? 0 : Math.max(0, Number(val));
                          setForm((prev) => ({ ...prev, weeklyGoalHours: isNaN(num) ? 0 : num }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-slate-900"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Daily Target (Hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.25"
                        value={dailyGoalInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDailyGoalInput(val);
                          const num = val.trim() === '' ? 0 : Math.max(0, Number(val));
                          setForm((prev) => ({ ...prev, dailyGoalHours: isNaN(num) ? 0 : num }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-slate-900"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-500 text-xs">
                    Goals disabled — the tracker will log sessions without displaying target lines or progress bars.
                  </div>
                )}
              </div>

              {/* Preferences */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                  Clock Access & Audio
                </div>

                {/* Persistent Floating Clock Bubble Toggle */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Persistent Floating Clock Bubble</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800">
                        Prototype
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      Shows a floating bottom-corner clock icon on all tabs so you can quick clock in/out without leaving your current screen.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.showFloatingClockBubble !== false}
                    onChange={(e) => setForm({ ...form, showFloatingClockBubble: e.target.checked })}
                    className="w-4 h-4 rounded-sm cursor-pointer shrink-0"
                    style={{ accentColor: currentTheme }}
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Clock Audio Chimes</div>
                    <div className="text-[11px] text-slate-500">
                      Synthesizes gentle chimes on Clock In and Clock Out
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.soundEnabled}
                    onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
                    className="w-4 h-4 rounded-sm cursor-pointer"
                    style={{ accentColor: currentTheme }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD & SYNC */}
          {activeTab === 'cloud' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Multi-Device Sign In Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950 space-y-1">
                <div className="font-bold text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Multi-Device Sign In
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  You can click the <strong>Sign In</strong> button in the header bar anytime to sync your timesheets effortlessly across all your laptops and mobile devices.
                </p>
              </div>

              {/* 1. Collapsible Section: Offline PWA & Mobile App */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 overflow-hidden transition-all shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsPwaSectionOpen(!isPwaSectionOpen)}
                  className="w-full p-3.5 flex items-start justify-between text-left hover:bg-emerald-50/80 transition-colors cursor-pointer gap-2"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Flag / Badge Row */}
                    <div>
                      {isPwaInstalled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                          <Check className="w-2.5 h-2.5 text-emerald-700" />
                          Installed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800">
                          Standalone Ready
                        </span>
                      )}
                    </div>
                    {/* Title and Icon */}
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <div className="font-bold text-emerald-950 uppercase tracking-wider text-[11px]">
                        Offline PWA & Mobile App
                      </div>
                    </div>
                    {/* Subtitle */}
                    <div className="text-[10px] text-emerald-850 truncate">
                      {isPwaInstalled ? 'App installed in standalone mode' : 'Add to home screen for fullscreen & offline access'}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5 text-emerald-800">
                    {isPwaSectionOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isPwaSectionOpen && (
                  <div className="p-3.5 pt-0 border-t border-emerald-200/60 space-y-2.5 animate-fadeIn mt-2 text-emerald-950">
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      Install Session Time Tracker onto your iPhone, iPad, Android, or desktop home screen to launch in fullscreen with zero address bar distraction.
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{deferredPrompt ? 'Install App to Device' : 'Add to Home Screen'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPwaGuide(!showPwaGuide)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium text-emerald-900 bg-emerald-100 hover:bg-emerald-200 transition-colors cursor-pointer"
                        title="Toggle install instructions"
                      >
                        {showPwaGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {showPwaGuide && (
                      <div className="pt-2 border-t border-emerald-200/80 text-[11px] text-emerald-900 space-y-1.5 animate-fadeIn">
                        <div className="font-bold text-[10px] uppercase text-emerald-950">Quick Install Instructions:</div>
                        <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 space-y-1">
                          <p><strong>iOS / Safari:</strong> Tap the <strong>Share</strong> button (box with arrow <Share2 className="w-2.5 h-2.5 inline text-emerald-700" />) at the bottom/top of Safari, then tap <strong>"Add to Home Screen"</strong>.</p>
                          <p><strong>Android / Chrome:</strong> Tap the three dots (<strong>⋮</strong>) in the top right corner, then select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Collapsible Section: 1-Tap Home Screen Buttons & Quick Actions */}
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 overflow-hidden transition-all shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsWidgetSectionOpen(!isWidgetSectionOpen)}
                  className="w-full p-3.5 flex items-start justify-between text-left hover:bg-sky-50/80 transition-colors cursor-pointer gap-2"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Flag / Badge Row */}
                    <div>
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900">
                        1-Tap Access
                      </span>
                    </div>
                    {/* Title and Icon */}
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <div className="font-bold text-sky-950 uppercase tracking-wider text-[11px]">
                        1-Tap Home Screen Buttons & Shortcuts
                      </div>
                    </div>
                    {/* Subtitle */}
                    <div className="text-[10px] text-sky-850 truncate">
                      Setup direct 1-tap Clock In/Out buttons on iPhone, Android & Lock Screen
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5 text-sky-800">
                    {isWidgetSectionOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isWidgetSectionOpen && (
                  <div className="p-3.5 pt-0 border-t border-sky-200/60 space-y-3 animate-fadeIn mt-2 text-sky-950">
                    <p className="text-[11px] text-sky-900 leading-relaxed">
                      Easily punch in and out directly from your phone's home screen or lock screen without navigating through menus.
                    </p>

                    {/* Action button */}
                    <div>
                      {onOpenWidgetGuide && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenWidgetGuide();
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-sky-700 text-white hover:bg-sky-800 transition-colors shadow-2xs text-xs font-bold cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            <span>Open 1-Tap Home Screen Setup Guide & URLs</span>
                          </span>
                          <ChevronRight className="w-4 h-4 text-white/80" />
                        </button>
                      )}
                    </div>

                    {/* Features Highlights */}
                    <div className="bg-white/80 rounded-lg p-2.5 border border-sky-200 space-y-1.5 text-[11px] text-sky-900">
                      <div className="font-bold text-[10px] uppercase text-sky-950 tracking-wider">
                        Available Options:
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-sky-700 shrink-0 mt-0.5" />
                        <span><strong>1-Tap Home Screen Icons:</strong> Standalone Clock In and Clock Out launcher icons on iPhone and Android.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-sky-700 shrink-0 mt-0.5" />
                        <span><strong>Apple Shortcuts Widget (iOS):</strong> Native Lock Screen & Home Screen widgets via iOS Shortcuts app.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-sky-700 shrink-0 mt-0.5" />
                        <span><strong>Android Long-Press Menu:</strong> Press & hold the installed app icon to clock in or out.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Collapsible Section: Google Apps Script Web App URL (Optional) */}
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 overflow-hidden transition-all shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsGasSectionOpen(!isGasSectionOpen)}
                  className="w-full p-3.5 flex items-start justify-between text-left hover:bg-blue-50/80 transition-colors cursor-pointer gap-2"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Flag / Badge Row */}
                    <div>
                      {form.gasEndpointUrl ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                          <Check className="w-2.5 h-2.5 text-blue-700" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                          Optional
                        </span>
                      )}
                    </div>
                    {/* Title and Icon */}
                    <div className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        Google Apps Script Web App URL (Optional)
                      </div>
                    </div>
                    {/* Subtitle */}
                    <div className="text-[10px] text-slate-500 truncate">
                      {form.gasEndpointUrl ? 'Live Google Sheet backup URL configured' : 'Local browser mode (click to configure Google Sheet)'}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5 text-blue-700">
                    {isGasSectionOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isGasSectionOpen && (
                  <div className="p-3.5 pt-0 border-t border-blue-200/60 space-y-2 animate-fadeIn mt-2">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Leave blank to run 100% locally in browser. Paste a deployed script URL to enable live Google Sheet cloud backup.
                    </p>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={form.gasEndpointUrl || ''}
                      onChange={(e) => setForm({ ...form, gasEndpointUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 font-mono shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GIFT & DATA MANAGEMENT */}
          {activeTab === 'gift' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Gift Section (Requested: "Hide gift within settings") */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-amber-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-700" />
                    Gift Clean Slate Time Tracker
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
                    Shareable
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Create and share a fresh, empty tracker link for your friends, clients, or team members with zero personal work history.
                </p>
                {/* Gift Community & Usage Metrics (Creator Only) */}
                {isCreator(form.userEmail || settings.userEmail) && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
                      <span className="flex items-center gap-1">
                        <Sparkle className="w-3 h-3 text-amber-600" />
                        Creator Live Metrics & App Reach
                      </span>
                      <span className="text-[9px] font-normal text-amber-700">Running Totals</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 rounded-xl bg-white border border-blue-200 text-center shadow-2xs">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-blue-900 uppercase">
                          <Users className="w-3 h-3 text-blue-600" />
                          <span>App Users</span>
                        </div>
                        <div className="text-sm font-extrabold font-mono text-slate-900 mt-0.5">
                          {usageStats.totalUniqueDevices || usageStats.totalUsers || 1}
                        </div>
                        <div className="text-[9px] text-slate-500">Unique Devices</div>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-indigo-200 text-center shadow-2xs">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-900 uppercase">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Accounts</span>
                        </div>
                        <div className="text-sm font-extrabold font-mono text-slate-900 mt-0.5">
                          {usageStats.totalSignedAccounts || 0}
                        </div>
                        <div className="text-[9px] text-slate-500">Signed-in Emails</div>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-emerald-200 text-center shadow-2xs">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-900 uppercase">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>Visits</span>
                        </div>
                        <div className="text-sm font-extrabold font-mono text-slate-900 mt-0.5">
                          {usageStats.totalVisits || 1}
                        </div>
                        <div className="text-[9px] text-slate-500">Total App Opens</div>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-amber-200 text-center shadow-2xs">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-900 uppercase">
                          <Gift className="w-3 h-3 text-amber-600" />
                          <span>Gifts</span>
                        </div>
                        <div className="text-sm font-extrabold font-mono text-slate-900 mt-0.5">
                          {usageStats.totalGiftsSent} / {usageStats.totalGiftsClaimed}
                        </div>
                        <div className="text-[9px] text-slate-500">Sent / Claimed</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleQuickCopyGift}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    {copiedGiftLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedGiftLink ? 'Gift Link Copied!' : 'Copy Blank Slate Link'}</span>
                  </button>

                  {onOpenGiftModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenGiftModal();
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Gift Wizard</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Data Tools */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Data Management
                  </div>
                  {isSampleActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Sample Mode Active
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  Seed sample 2-week records with weekday and weekend sessions for charts, or clear sample test data anytime.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetSampleData}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Seed Sample Sessions</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSampleData}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Clear Sample Data</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWipeAll}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wipe All Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SUGGESTION / FEEDBACK FORM */}
          {activeTab === 'suggestion' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2 text-slate-600 text-xs">
                <MessageSquarePlus className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All suggestions are routed directly to the creator.</span>
              </div>

              {suggestionSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{suggestionSuccessMessage}</span>
                  </div>
                  {lastSubmittedPayload && (
                    <div className="pt-2 border-t border-emerald-200/70 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-emerald-800">
                        Want to send directly from your personal Gmail or email app as well?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          openSuggestionInEmail({
                            ticketId: lastSubmittedPayload.ticketId,
                            name: lastSubmittedPayload.name,
                            email: lastSubmittedPayload.email,
                            category: lastSubmittedPayload.category,
                            message: lastSubmittedPayload.message,
                          }, true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open Pre-filled in Gmail</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {suggestionErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Could not send to server</div>
                    <div className="text-[11px] text-rose-800">{suggestionErrorMessage}</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitSuggestion} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Your Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Alex"
                      value={suggestionName}
                      onChange={(e) => setSuggestionName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Your Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={suggestionEmail}
                      onChange={(e) => setSuggestionEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    Category
                  </label>
                  <select
                    value={suggestionCategory}
                    onChange={(e) => setSuggestionCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 shadow-2xs cursor-pointer"
                  >
                    <option value="Feature Request">✨ Feature Request / Idea</option>
                    <option value="UI/UX Polish">🎨 UI / UX Polish &amp; Ergonomics</option>
                    <option value="Bug Report">🐛 Bug Report / Calculation Fix</option>
                    <option value="General Feedback">💬 General Feedback</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">
                    Suggestion / Feedback *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe what would make Session Time Tracker better for your daily workflow..."
                    value={suggestionMessage}
                    onChange={(e) => setSuggestionMessage(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 shadow-2xs resize-none"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingSuggestion || !suggestionMessage.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
                    style={{ backgroundColor: currentTheme }}
                  >
                    {isSubmittingSuggestion ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Suggestion...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Suggestion</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: CREATOR INBOX */}
          {activeTab === 'inbox' && isCreator(settings.userEmail) && (() => {
            const filteredList = creatorSuggestionsList.filter((sug) => {
              const status = sug.status || 'new';
              if (inboxFilter === 'all') return true;
              if (inboxFilter === 'new') return status === 'new' || status === 'reviewed';
              if (inboxFilter === 'in_progress') return status === 'in_progress';
              if (inboxFilter === 'completed') return status === 'completed';
              return true;
            });

            const newCount = creatorSuggestionsList.filter((s) => (s.status || 'new') === 'new' || s.status === 'reviewed').length;
            const inProgressCount = creatorSuggestionsList.filter((s) => s.status === 'in_progress').length;
            const completedCount = creatorSuggestionsList.filter((s) => s.status === 'completed').length;

            return (
              <div className="space-y-3 animate-fadeIn">
                {/* Header & Controls */}
                <div className="flex items-start justify-between gap-2 flex-wrap border-b border-slate-200 pb-2.5">
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      <span>Creator Change Requests Inbox ({creatorSuggestionsList.length})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                      <span>Auto-routed to <strong>{CREATOR_EMAIL}</strong> &amp; logged to server audit trail</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => exportSuggestionsToMarkdownFile(creatorSuggestionsList)}
                      disabled={creatorSuggestionsList.length === 0}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                      title="Download complete backlog as Markdown file"
                    >
                      <Download className="w-3 h-3 text-slate-500" />
                      <span>Export (.md)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestEmail}
                      disabled={isTestingEmail}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                      title="Verify email routing to reyesabel36@gmail.com"
                    >
                      {isTestingEmail ? <Loader2 className="w-3 h-3 animate-spin text-emerald-600" /> : <SendHorizontal className="w-3 h-3 text-slate-500" />}
                      <span>Test Route</span>
                    </button>

                    <button
                      type="button"
                      onClick={loadSuggestions}
                      disabled={isLoadingSuggestions}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3 h-3 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Direct Delivery Notice */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <div><strong>Direct Email Delivery:</strong> Submissions are automatically forwarded to <strong>{CREATOR_EMAIL}</strong> via server transactional mailer and FormSubmit relay.</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Tip: If this is your first time using FormSubmit, please check your Gmail for a 1-time activation confirmation. You can also click <strong>Open in Gmail</strong> on any ticket to view and reply instantly.</div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInboxFilter('all')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      inboxFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({creatorSuggestionsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter('new')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      inboxFilter === 'new' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🆕 New ({newCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter('in_progress')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      inboxFilter === 'in_progress' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⏳ In Progress ({inProgressCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilter('completed')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      inboxFilter === 'completed' ? 'bg-white text-blue-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✅ Done ({completedCount})
                  </button>
                </div>

                {gmailNotification && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${gmailNotification.isError ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
                    {gmailNotification.isError ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
                    <span>{gmailNotification.text}</span>
                  </div>
                )}

                {filteredList.length === 0 ? (
                  <EmptyState
                    icon={Mail}
                    title="No tickets in this view"
                    description={`No change requests matching filter "${inboxFilter}". New suggestions from all devices appear here and are dispatched to ${CREATOR_EMAIL}.`}
                    compact
                  />
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {filteredList.map((sug) => {
                      const status = sug.status || 'new';
                      const isEditingNotes = editingNotesId === sug.id;

                      return (
                        <div
                          key={sug.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Ticket ID Badge */}
                              <button
                                type="button"
                                onClick={() => handleCopyTicketMarkdown(sug)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Click to copy ticket Markdown"
                              >
                                <span>{sug.ticketId || 'CR-TICKET'}</span>
                                {copiedTicketId === sug.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <ClipboardCopy className="w-2.5 h-2.5 text-slate-300" />}
                              </button>

                              {/* Category Badge */}
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                                {sug.category || 'Feedback'}
                              </span>

                              {/* Status Dropdown */}
                              <select
                                value={status}
                                onChange={(e) => handleUpdateStatus(sug.id, e.target.value as SuggestionStatus)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                                  status === 'completed'
                                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                                    : status === 'in_progress'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}
                              >
                                <option value="new">🆕 New</option>
                                <option value="reviewed">📋 Reviewed</option>
                                <option value="in_progress">⏳ In Progress</option>
                                <option value="completed">✅ Resolved / Done</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-slate-400 font-medium">
                                {sug.createdAt ? new Date(sug.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }) : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDialog({
                                    title: 'Delete Change Request Entry?',
                                    message: `Are you sure you want to delete ticket ${sug.ticketId || sug.id} from your Creator Inbox?`,
                                    confirmText: 'Delete Ticket',
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      await deleteCreatorSuggestion(sug.id);
                                      loadSuggestions();
                                    },
                                  });
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete change request"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Submitter Info */}
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{sug.name || 'Anonymous User'}</span>
                            {sug.email && (
                              <a
                                href={`mailto:${sug.email}?subject=Re: Change Request ${sug.ticketId || ''} - Session Time Tracker`}
                                className="text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                &lt;{sug.email}&gt;
                              </a>
                            )}
                          </div>

                          {/* Message Body */}
                          <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {sug.message}
                          </p>

                          {/* Creator Notes / Plan */}
                          {isEditingNotes ? (
                            <div className="space-y-1.5 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/80 animate-fadeIn">
                              <label className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                                <Edit3 className="w-3 h-3" />
                                <span>Creator Plan &amp; Notes:</span>
                              </label>
                              <textarea
                                rows={2}
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                placeholder="Log your implementation notes, planned release, or changelog summary..."
                                className="w-full bg-white border border-amber-300 rounded-md p-1.5 text-xs text-slate-800 focus:outline-amber-600 resize-none"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingNotesId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveNotes(sug.id, notesDraft)}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-700 text-white hover:bg-amber-800 cursor-pointer shadow-2xs"
                                >
                                  <Save className="w-2.5 h-2.5" />
                                  <span>Save Note</span>
                                </button>
                              </div>
                            </div>
                          ) : sug.creatorNotes ? (
                            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-200/60 text-[11px] text-amber-950 flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-amber-900 text-[10px] uppercase block">Creator Notes:</span>
                                <span className="whitespace-pre-wrap">{sug.creatorNotes}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNotesId(sug.id);
                                  setNotesDraft(sug.creatorNotes || '');
                                }}
                                className="text-[10px] font-semibold text-amber-800 hover:underline shrink-0 cursor-pointer"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotesId(sug.id);
                                setNotesDraft('');
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>+ Add Creator Notes / Plan</span>
                            </button>
                          )}

                          {/* Action Footer */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span>Ticket: {sug.ticketId || sug.id}</span>
                              {sug.emailDispatched && (
                                <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Auto-sent
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleCopyTicketMarkdown(sug)}
                                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                                title="Copy Markdown summary for changelog"
                              >
                                <ClipboardCopy className="w-3 h-3" />
                                <span>{copiedTicketId === sug.id ? 'Copied!' : 'Copy Markdown'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleForwardSuggestionToGmail(sug)}
                                disabled={forwardingId === sug.id}
                                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                                title="Open pre-formatted draft in Gmail"
                              >
                                {forwardingId === sug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                <span>Open in Gmail</span>
                              </button>

                              {sug.email && (
                                <a
                                  href={`mailto:${sug.email}?subject=Re: Change Request ${sug.ticketId || ''} - Session Time Tracker`}
                                  className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Reply Submitter</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>

        {/* Sticky Footer - Always accessible without scrolling */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
              <span className="font-bold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                v{APP_VERSION}
              </span>
            </div>
            {onSyncRefresh && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSyncRefresh();
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-all shadow-2xs"
                title="Check for newest published build and refresh"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Check Updates</span>
              </button>
            )}
          </div>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98"
            style={{ backgroundColor: currentTheme }}
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{savedSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={currentTheme}
      />
    </div>
  );
}
