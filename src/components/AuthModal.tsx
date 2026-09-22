import { useState, FormEvent, useEffect } from 'react';
import { 
  Mail, 
  X, 
  Check, 
  Cloud, 
  RefreshCw, 
  LogOut, 
  AlertCircle,
  Smartphone,
  Laptop
} from 'lucide-react';
import { SyncStatusType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  syncStatus: SyncStatusType;
  lastSyncedAt?: string;
  onLoginWithEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
  onManualSync: () => Promise<void>;
  themeColor?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  userEmail,
  syncStatus,
  lastSyncedAt,
  onLoginWithEmail,
  onLogout,
  onManualSync,
  themeColor = '#0284C7',
}: AuthModalProps) {
  const [emailInput, setEmailInput] = useState<string>(userEmail || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmailInput(userEmail || '');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await onLoginWithEmail(trimmedEmail);
      
      if (res.success) {
        setSuccessMsg('Cross-device sync connected successfully!');
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setErrorMsg(res.error || 'Could not connect. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    onLogout();
    setEmailInput('');
    setSuccessMsg('Sync disconnected on this device.');
  };

  const isCurrentlyConnected = Boolean(userEmail && userEmail.includes('@'));

  return (
    <div 
      id="sync-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="sync-modal-content"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Cross-Device Cloud Sync
              </h3>
            </div>
          </div>
          <button
            id="close-sync-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1">
          {/* Active Connection Status Badge */}
          {isCurrentlyConnected && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-900">
                    Sync Active
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200">
                  {syncStatus === 'syncing' ? 'Syncing...' : 'Live'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 truncate">
                {userEmail}
              </p>
              {lastSyncedAt && (
                <p className="text-[11px] text-slate-500">
                  Last synced: {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs font-medium">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Device Sync Info Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-slate-600 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1 shrink-0 mt-0.5 text-slate-400">
              <Smartphone className="w-3.5 h-3.5" />
              <span className="text-[10px]">↔</span>
              <Laptop className="w-3.5 h-3.5" />
            </div>
            <div>
              Enter your email on any other device (phone, laptop, iPad) to automatically load and synchronize all your sessions, projects, and notes in real-time.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Your Sync Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="sync-email-input"
                  type="email"
                  required
                  placeholder="e.g. yourname@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                No sign-in or password required. Works with any email address.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col space-y-2">
              <button
                id="connect-sync-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>{isCurrentlyConnected ? 'Update Sync Email' : 'Connect & Start Syncing'}</span>
                  </>
                )}
              </button>

              {isCurrentlyConnected && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onManualSync}
                    disabled={isLoading || syncStatus === 'syncing'}
                    className="flex-1 py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sync Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2 px-3 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
