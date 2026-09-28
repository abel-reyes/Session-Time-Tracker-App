import { useState, FormEvent, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Key, 
  ShieldCheck, 
  Check, 
  Copy, 
  Cloud, 
  RefreshCw, 
  LogOut, 
  AlertCircle, 
  Smartphone, 
  Laptop, 
  ChevronLeft, 
  X,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { SyncStatusType } from '../types';
import { 
  checkEmailAuth, 
  loginWithPassphrase, 
  setupPassphrase, 
  requestPasswordReset, 
  resetPassphraseWithCode,
  loadRecoveryKey,
  saveRecoveryKey,
  loadRememberDevice,
  loadAuthToken
} from '../utils/storage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  syncStatus: SyncStatusType;
  lastSyncedAt?: string;
  onLoginSuccess: (email: string, token?: string) => Promise<void>;
  onLogout: () => void;
  onManualSync: () => Promise<void>;
  themeColor?: string;
}

type AuthViewMode = 'check' | 'login' | 'setup' | 'forgot' | 'reset' | 'recovery_display' | 'connected';

export function AuthModal({
  isOpen,
  onClose,
  userEmail,
  syncStatus,
  lastSyncedAt,
  onLoginSuccess,
  onLogout,
  onManualSync,
  themeColor = '#0284C7',
}: AuthModalProps) {
  // Navigation / view state
  const [viewMode, setViewMode] = useState<AuthViewMode>('check');
  const [emailInput, setEmailInput] = useState<string>(userEmail || '');
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [confirmPassphraseInput, setConfirmPassphraseInput] = useState<string>('');
  const [resetCodeInput, setResetCodeInput] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(() => loadRememberDevice());

  // Show/Hide toggle states
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState<boolean>(false);

  // Recovery Key display
  const [currentRecoveryKey, setCurrentRecoveryKey] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Diagnostic / dev code for zero-cost / preview environments
  const [devResetCode, setDevResetCode] = useState<string | null>(null);

  // Account detection flags
  const [isExistingAccount, setIsExistingAccount] = useState<boolean>(false);

  // Status & feedback
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isCurrentlyConnected = Boolean(userEmail && userEmail.includes('@') && loadAuthToken());

  useEffect(() => {
    if (isOpen) {
      setEmailInput(userEmail || '');
      setPassphraseInput('');
      setConfirmPassphraseInput('');
      setResetCodeInput('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowPassphrase(false);
      setShowConfirmPassphrase(false);
      setCopiedKey(false);
      setDevResetCode(null);

      const existingRecovery = loadRecoveryKey();
      if (existingRecovery) {
        setCurrentRecoveryKey(existingRecovery);
      }

      if (userEmail && userEmail.includes('@')) {
        setViewMode('connected');
      } else {
        setViewMode('check');
      }
    }
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  // Passphrase strength calculation helper
  const getPassphraseStrength = (pass: string) => {
    const len = pass.length;
    if (len === 0) return null;
    if (len < 6) return { label: 'Too short (min 6 chars)', color: 'text-amber-600', bar: 'w-1/4 bg-amber-500' };
    if (pass.includes(' ') && pass.trim().split(/\s+/).length >= 3) {
      return { label: 'Very Strong Passphrase (Great!)', color: 'text-emerald-700', bar: 'w-full bg-emerald-600' };
    }
    if (len < 10) return { label: 'Good (Fair)', color: 'text-sky-600', bar: 'w-2/4 bg-sky-500' };
    if (len < 16) return { label: 'Strong Passphrase', color: 'text-emerald-600', bar: 'w-3/4 bg-emerald-500' };
    return { label: 'Very Strong Passphrase!', color: 'text-emerald-700', bar: 'w-full bg-emerald-600' };
  };

  const strength = getPassphraseStrength(passphraseInput);

  // STEP 1: Handle Email Check
  const handleCheckEmail = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const checkRes = await checkEmailAuth(clean);
      if (checkRes.exists && checkRes.hasPassphrase) {
        // User has a passphrase -> prompt login
        setIsExistingAccount(true);
        setViewMode('login');
      } else if (checkRes.exists && !checkRes.hasPassphrase) {
        // User exists (legacy account) -> prompt to set up passphrase without losing data!
        setIsExistingAccount(true);
        setViewMode('setup');
      } else {
        // Brand new account
        setIsExistingAccount(false);
        setViewMode('setup');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not verify account. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Handle Passphrase Login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!passphraseInput) {
      setErrorMsg('Please enter your passphrase.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginWithPassphrase(cleanEmail, passphraseInput, rememberDevice);
      if (res.success) {
        if (res.recoveryKey) {
          setCurrentRecoveryKey(res.recoveryKey);
          saveRecoveryKey(res.recoveryKey);
        }
        setSuccessMsg('Passphrase verified! Synchronizing cloud data...');
        await onLoginSuccess(cleanEmail, res.token);
        setTimeout(() => {
          onClose();
        }, 600);
      } else if (res.requireSetup) {
        setIsExistingAccount(true);
        setViewMode('setup');
      } else {
        setErrorMsg(res.error || 'Incorrect passphrase. Please try again or use Forgot Passphrase.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Handle Passphrase Setup (New account or Existing user without passphrase)
  const handleSetupPassphrase = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!passphraseInput || passphraseInput.length < 6) {
      setErrorMsg('Passphrase must be at least 6 characters long.');
      return;
    }

    if (passphraseInput !== confirmPassphraseInput) {
      setErrorMsg('Passphrases do not match. Please re-check both inputs.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await setupPassphrase(cleanEmail, passphraseInput, rememberDevice);
      if (res.success) {
        if (res.recoveryKey) {
          setCurrentRecoveryKey(res.recoveryKey);
          saveRecoveryKey(res.recoveryKey);
        }
        await onLoginSuccess(cleanEmail, res.token);
        setSuccessMsg('Passphrase saved! Your account is now fully secured.');
        // Show emergency recovery key so the user can copy it!
        setViewMode('recovery_display');
      } else {
        setErrorMsg(res.error || 'Failed to save passphrase.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 4: Handle Forgot Passphrase Request
  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMsg(res.message || 'Reset code sent! Check your inbox.');
        if (res.devCode) {
          setDevResetCode(res.devCode);
        }
        setViewMode('reset');
      } else {
        setErrorMsg(res.error || 'Could not send reset code. Please check your email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 5: Handle Reset Passphrase with 6-digit Code or Emergency Recovery Key
  const handleResetPassphrase = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!resetCodeInput.trim()) {
      setErrorMsg('Please enter the 6-digit verification code or your Emergency Recovery Key.');
      return;
    }

    if (!passphraseInput || passphraseInput.length < 6) {
      setErrorMsg('New passphrase must be at least 6 characters long.');
      return;
    }

    if (passphraseInput !== confirmPassphraseInput) {
      setErrorMsg('New passphrases do not match. Please re-check both inputs.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassphraseWithCode(cleanEmail, resetCodeInput.trim(), passphraseInput, rememberDevice);
      if (res.success) {
        if (res.recoveryKey) {
          setCurrentRecoveryKey(res.recoveryKey);
          saveRecoveryKey(res.recoveryKey);
        }
        await onLoginSuccess(cleanEmail, res.token);
        setSuccessMsg('Passphrase reset successfully! Cloud data unlocked.');
        setViewMode('recovery_display');
      } else {
        setErrorMsg(res.error || 'Invalid verification code or recovery key. Please check again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!currentRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(currentRecoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDisconnect = () => {
    onLogout();
    setEmailInput('');
    setPassphraseInput('');
    setConfirmPassphraseInput('');
    setCurrentRecoveryKey('');
    setViewMode('check');
    setSuccessMsg('Disconnected on this device.');
  };

  return (
    <div 
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="auth-modal-content"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            {viewMode !== 'check' && viewMode !== 'connected' && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  if (viewMode === 'reset') setViewMode('forgot');
                  else if (viewMode === 'forgot' || viewMode === 'setup' || viewMode === 'login') setViewMode('check');
                  else setViewMode('connected');
                }}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer mr-0.5"
                title="Go back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div 
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {viewMode === 'login' && 'Passphrase Login'}
                {viewMode === 'setup' && (isExistingAccount ? 'Secure Existing Account' : 'Set Account Passphrase')}
                {viewMode === 'forgot' && 'Reset Passphrase'}
                {viewMode === 'reset' && 'Enter Verification Code'}
                {viewMode === 'recovery_display' && 'Emergency Recovery Key'}
                {viewMode === 'check' && 'Cross-Device Account Sync'}
                {viewMode === 'connected' && 'Account & Sync Status'}
              </h3>
            </div>
          </div>
          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1">
          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs font-medium animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs font-medium animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          {/* MODE 1: CONNECTED VIEW (Logged In) */}
          {viewMode === 'connected' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-900">
                      Sync Active &amp; Protected
                    </span>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200">
                    {syncStatus === 'syncing' ? 'Syncing...' : 'Live Cloud'}
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

              {/* Emergency Recovery Key Box */}
              {currentRecoveryKey && (
                <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-sky-950 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-700" />
                      Your Emergency Recovery Key
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRecoveryKey}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <div className="font-mono font-bold text-sm bg-white border border-sky-200 px-3 py-1.5 rounded-lg text-sky-900 tracking-wider text-center select-all">
                    {currentRecoveryKey}
                  </div>
                  <p className="text-[10px] text-sky-700 leading-tight">
                    Keep this key in a safe place. You can use it to recover your account if you forget your passphrase.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={onManualSync}
                  disabled={isLoading || syncStatus === 'syncing'}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('setup');
                    setIsExistingAccount(true);
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Change Passphrase</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full py-2 px-3 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect on This Device</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: EMAIL CHECK (Entry Step) */}
          {viewMode === 'check' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-slate-600 text-[11px] leading-relaxed">
                <div className="flex items-center gap-1 shrink-0 mt-0.5 text-slate-400">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="text-[10px]">↔</span>
                  <Laptop className="w-3.5 h-3.5" />
                </div>
                <div>
                  Enter your email address. If you've used Session Time Tracker before, your cloud data will be seamlessly loaded and protected by your passphrase.
                </div>
              </div>

              <form onSubmit={handleCheckEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-check-email-input"
                      type="email"
                      required
                      placeholder="e.g. yourname@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Protected with 100% free server-side passphrase encryption. Zero fees forever.
                  </p>
                </div>

                <button
                  id="auth-continue-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Checking Account...</span>
                    </>
                  ) : (
                    <span>Continue &rarr;</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* MODE 3: LOGIN (Enter Passphrase) */}
          {viewMode === 'login' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-[11px]">
                <div className="truncate">
                  <span className="text-slate-500">Signing in as: </span>
                  <span className="font-bold text-slate-900 truncate">{emailInput}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('check')}
                  className="text-sky-600 hover:text-sky-800 font-bold shrink-0 ml-2 cursor-pointer text-[10px]"
                >
                  Change
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Account Passphrase
                    </label>
                    <button
                      type="button"
                      onClick={() => setViewMode('forgot')}
                      className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 cursor-pointer"
                    >
                      Forgot passphrase?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-login-passphrase-input"
                      type={showPassphrase ? 'text' : 'password'}
                      required
                      placeholder="Enter your passphrase"
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      title={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember This Device Checkbox */}
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded-sm cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <div className="text-[11px] text-slate-700 leading-tight">
                    <strong className="text-slate-900">Remember this device</strong>
                    <p className="text-[10px] text-slate-500">Stay signed in on this device for 30 days without retyping your passphrase.</p>
                  </div>
                </label>

                <button
                  id="auth-unlock-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Passphrase...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Unlock &amp; Sync</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* MODE 4: SETUP PASSPHRASE (New User or Existing User without Passphrase) */}
          {viewMode === 'setup' && (
            <div className="space-y-4">
              {isExistingAccount ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-amber-950">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Existing Account Detected!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Your previous timesheets, projects, and settings are safe in the cloud. Create a passphrase now to keep them securely protected across all devices.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl space-y-1 text-sky-900">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-sky-950">
                    <Lock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Create Your Secure Passphrase</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Choose a memorable passphrase to protect your personal cloud timesheets. You can use standard passwords or friendly phrases with spaces.
                  </p>
                </div>
              )}

              <form onSubmit={handleSetupPassphrase} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Create Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-setup-passphrase-input"
                      type={showPassphrase ? 'text' : 'password'}
                      required
                      placeholder="e.g. coffee guitar river sunset or password"
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      title={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Real-time Strength Indicator */}
                  {strength && (
                    <div className="mt-1.5 space-y-1 animate-fadeIn">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${strength.bar}`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold ${strength.color}`}>{strength.label}</span>
                        <span className="text-slate-400">{passphraseInput.length} chars</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-confirm-passphrase-input"
                      type={showConfirmPassphrase ? 'text' : 'password'}
                      required
                      placeholder="Retype your passphrase"
                      value={confirmPassphraseInput}
                      onChange={(e) => setConfirmPassphraseInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      title={showConfirmPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      {showConfirmPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Passphrase Flexibility Tip */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Passphrase Flexibility:</strong> Spaces are fully supported! A phrase of 3-4 memorable words (like <code className="text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">summer river guitar coffee</code>) is easy to remember and extremely secure.
                  </span>
                </div>

                {/* Remember This Device Checkbox */}
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded-sm cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <div className="text-[11px] text-slate-700 leading-tight">
                    <strong className="text-slate-900">Remember this device</strong>
                    <p className="text-[10px] text-slate-500">Auto-unlock on this trusted device without typing passphrase every time.</p>
                  </div>
                </label>

                <button
                  id="auth-save-passphrase-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Passphrase...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Save Passphrase &amp; Connect</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* MODE 5: EMERGENCY RECOVERY KEY DISPLAY */}
          {viewMode === 'recovery_display' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950 pt-1">Account Secured Successfully!</h4>
                <p className="text-[11px] text-emerald-800">
                  Your passphrase is now active. Here is your unique Emergency Recovery Key:
                </p>
              </div>

              <div className="p-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 space-y-2 text-center">
                <span className="font-bold text-[10px] uppercase text-sky-800 tracking-wider">
                  Emergency Recovery Key
                </span>
                <div className="font-mono font-extrabold text-base sm:text-lg bg-white border border-sky-200 py-2 px-3 rounded-lg text-sky-950 tracking-widest select-all">
                  {currentRecoveryKey}
                </div>
                <button
                  type="button"
                  onClick={handleCopyRecoveryKey}
                  className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? 'Recovery Key Copied!' : 'Copy Recovery Key'}</span>
                </button>
                <p className="text-[10px] text-slate-500 leading-tight pt-1">
                  Save this key in your notes or password manager. If you ever forget your passphrase and cannot access your email, this key allows you to reset your account immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: themeColor }}
              >
                <span>Done &bull; Start Tracking</span>
              </button>
            </div>
          )}

          {/* MODE 6: FORGOT PASSPHRASE */}
          {viewMode === 'forgot' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">Forgot your passphrase?</p>
                <p>
                  We can send a 6-digit verification code to your email, or you can enter your <strong>Emergency Recovery Key</strong> to reset your passphrase instantly.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. yourname@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Reset Code...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send 6-Digit Email Code</span>
                    </>
                  )}
                </button>

                {/* Option to use Emergency Recovery Key directly */}
                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('reset')}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
                  >
                    I have my Emergency Recovery Key &rarr;
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* MODE 7: RESET PASSPHRASE (Enter Code/Key + New Passphrase) */}
          {viewMode === 'reset' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50/80 rounded-xl border border-sky-200 text-[11px] text-sky-900 space-y-1">
                <p className="font-bold text-sky-950">Verify Your Account</p>
                <p>
                  Enter the 6-digit code sent to <strong>{emailInput}</strong>, or enter your <strong>Emergency Recovery Key</strong> (STT-...).
                </p>
              </div>

              {/* Dev / Preview Hint for testing if zero-config */}
              {devResetCode && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>⚡ Quick Test Reset Code:</span>
                    <button
                      type="button"
                      onClick={() => setResetCodeInput(devResetCode)}
                      className="px-2 py-0.5 bg-emerald-200 text-emerald-950 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Fill Code
                    </button>
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-950 tracking-wider">
                    {devResetCode}
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    (Provided directly for instantaneous testing with zero wait!)
                  </p>
                </div>
              )}

              <form onSubmit={handleResetPassphrase} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Code OR Emergency Recovery Key
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456 or STT-XXXX-XXXX"
                      value={resetCodeInput}
                      onChange={(e) => setResetCodeInput(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs tracking-wider"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      required
                      placeholder="Enter new passphrase (min 6 chars)"
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm New Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassphrase ? 'text' : 'password'}
                      required
                      placeholder="Retype new passphrase"
                      value={confirmPassphraseInput}
                      onChange={(e) => setConfirmPassphraseInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-slate-900 shadow-2xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showConfirmPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember This Device Checkbox */}
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded-sm cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <div className="text-[11px] text-slate-700 leading-tight">
                    <strong className="text-slate-900">Remember this device</strong>
                    <p className="text-[10px] text-slate-500">Keep me logged in for 30 days.</p>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Passphrase...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Update Passphrase &amp; Unlock</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
