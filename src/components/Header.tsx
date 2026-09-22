import { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Settings, 
  FileSpreadsheet, 
  Calendar,
  CalendarDays, 
  ChevronDown,
  FolderKanban,
  Cloud,
  User,
  Pencil,
  Check,
  X,
  LayoutGrid,
  BarChart3,
  ListTodo,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { getQuarterName } from '../utils/timeCalculations';
import { SyncStatusType } from '../types';

interface HeaderProps {
  appTitle?: string;
  onUpdateAppTitle?: (title: string) => void;
  activeQuarter: string;
  onQuarterChange: (quarter: string) => void;
  availableQuarters: string[];
  userEmail?: string;
  syncStatus: SyncStatusType;
  lastSyncedAt?: string;
  onSyncRefresh?: () => void;
  isSyncRefreshing?: boolean;
  onOpenAuthModal: () => void;
  onOpenProjectsModal: () => void;
  onOpenQuarterWeeksModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenTimesheetModal: () => void;
  isPunchedIn: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  themeColor?: string;
}

export function Header({
  appTitle = 'Session Time Tracker',
  onUpdateAppTitle,
  activeQuarter,
  onQuarterChange,
  availableQuarters,
  userEmail,
  syncStatus,
  lastSyncedAt,
  onSyncRefresh,
  isSyncRefreshing = false,
  onOpenAuthModal,
  onOpenProjectsModal,
  onOpenQuarterWeeksModal,
  onOpenSettingsModal,
  onOpenTimesheetModal,
  isPunchedIn,
  activeTab,
  onTabChange,
  themeColor = '#0284C7',
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(appTitle);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedTitle(appTitle);
  }, [appTitle]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim() || 'Session Time Tracker';
    if (onUpdateAppTitle) {
      onUpdateAppTitle(trimmed);
    }
    setIsEditingTitle(false);
  };

  const isLoggedIn = Boolean(userEmail && userEmail.includes('@'));

  // Mobile has 3 options: Clock Buttons, Metrics, Recent Entries
  const mobileTabOptions = [
    { id: 'clock', label: 'Clock Buttons', icon: Clock },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'recent', label: 'Recent Entries', icon: ListTodo },
  ];

  // Desktop has 2 options: Clock & Metrics, Recent Entries
  const desktopTabOptions = [
    { id: 'clock-metrics', label: 'Clock & Metrics', icon: LayoutGrid },
    { id: 'recent', label: 'Recent Entries', icon: ListTodo },
  ];

  // Determine current active label
  const getActiveTabLabel = (isMobile: boolean) => {
    if (isMobile) {
      if (activeTab === 'metrics') return 'Metrics';
      if (activeTab === 'recent') return 'Recent Entries';
      return 'Clock Buttons';
    } else {
      if (activeTab === 'recent') return 'Recent Entries';
      return 'Clock & Metrics';
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-3 sm:px-4 lg:px-8 py-2 transition-all">
      <div className="max-w-7xl mx-auto space-y-2">
        {/* Top Row: App Title & Branding on Left, Quarter & Account Sync on Right */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Left: Brand & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shadow-2xs transition-colors shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') {
                          setEditedTitle(appTitle);
                          setIsEditingTitle(false);
                        }
                      }}
                      autoFocus
                      placeholder="Name your tracker..."
                      className="text-sm sm:text-base font-bold text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 bg-slate-50 outline-none w-36 sm:w-56"
                    />
                    <button
                      onClick={handleSaveTitle}
                      className="p-1 rounded text-white cursor-pointer"
                      style={{ backgroundColor: themeColor }}
                      title="Save title"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditedTitle(appTitle);
                        setIsEditingTitle(false);
                      }}
                      className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <h1 
                      onClick={() => setIsEditingTitle(true)}
                      className="text-xs sm:text-sm md:text-base font-bold text-slate-900 tracking-tight cursor-pointer hover:opacity-80 transition-opacity truncate max-w-[150px] sm:max-w-[240px] md:max-w-none"
                      title="Click to rename your application"
                    >
                      {appTitle}
                    </h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-opacity"
                      title="Rename tracker"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                <span>{currentDate}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                <span className="font-mono font-medium text-slate-700 shrink-0">{currentTime}</span>
              </p>
            </div>
          </div>

          {/* Top Row Right: Quarter Selector and Account Sync Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quarter Selector Dropdown */}
            <div className="relative flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-0.5 transition-colors shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2 shrink-0" />
              <select
                id="header-quarter-select"
                value={activeQuarter}
                onChange={(e) => onQuarterChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 py-1 pl-1.5 pr-6 outline-none cursor-pointer appearance-none"
              >
                {Array.from(new Set(availableQuarters)).map((q) => (
                  <option key={`quarter-opt-${q}`} value={q}>
                    {q} {q === getQuarterName() ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
            </div>

            {/* Cross-Device Cloud Sync Button */}
            <button
              id="btn-open-auth"
              onClick={onOpenAuthModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border shadow-2xs ${
                isLoggedIn
                  ? 'text-emerald-900 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
              }`}
              title={isLoggedIn ? `Cross-device sync active for ${userEmail}` : 'Cross-Device Sync: Enter email to sync across devices (no sign-in needed)'}
            >
              {isLoggedIn ? (
                <span 
                  className="w-4 h-4 rounded-full text-white font-bold text-[9px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
                  {userEmail![0]?.toUpperCase()}
                </span>
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="max-w-[70px] sm:max-w-[100px] truncate">
                {isLoggedIn ? userEmail?.split('@')[0] : 'Cloud Sync'}
              </span>
            </button>

            {/* Sync & Refresh Button */}
            <button
              id="btn-header-sync-refresh"
              type="button"
              onClick={onSyncRefresh}
              disabled={isSyncRefreshing || syncStatus === 'syncing'}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                isSyncRefreshing || syncStatus === 'syncing'
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                  : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95'
              }`}
              title={
                isLoggedIn
                  ? `Sync cloud data & apply newest publication updates${lastSyncedAt ? ` (Last synced: ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}`
                  : 'Refresh app & apply newest publication updates'
              }
              aria-label="Sync and Refresh"
            >
              <RefreshCw 
                className={`w-3.5 h-3.5 transition-transform ${
                  isSyncRefreshing || syncStatus === 'syncing'
                    ? 'animate-spin'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={
                  isSyncRefreshing || syncStatus === 'syncing'
                    ? { color: themeColor }
                    : undefined
                }
              />
            </button>
          </div>
        </div>

        {/* Bottom Pinned Row: Tab Selector on Left, Projects & Timesheet in Middle, Settings on Right */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          {/* Pinned Tab Selector ("View Selections") on the Left */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              id="btn-view-tabs-dropdown"
              type="button"
              onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border"
              style={{
                backgroundColor: `${themeColor}12`,
                borderColor: `${themeColor}40`,
                color: themeColor,
              }}
              title="Switch view selection modes"
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden font-bold">
                {getActiveTabLabel(true)}
              </span>
              <span className="hidden sm:inline font-bold">
                {getActiveTabLabel(false)}
              </span>
              <ChevronDown 
                className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-200 shrink-0 ${
                  isTabDropdownOpen ? 'rotate-180' : ''
                }`} 
              />
            </button>

            {/* Dropdown Menu */}
            {isTabDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-52 max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
                {/* Mobile Tab Options */}
                <div className="block sm:hidden">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    View Selections (Mobile)
                  </div>
                  {mobileTabOptions.map((opt) => {
                    const IconComp = opt.icon;
                    const isSelected = activeTab === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onTabChange(opt.id);
                          setIsTabDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp 
                            className="w-3.5 h-3.5" 
                            style={isSelected ? { color: themeColor } : undefined}
                          />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: themeColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Desktop Tab Options */}
                <div className="hidden sm:block">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    View Modes
                  </div>
                  {desktopTabOptions.map((opt) => {
                    const IconComp = opt.icon;
                    const isSelected = 
                      opt.id === 'clock-metrics' 
                        ? (activeTab === 'clock-metrics' || activeTab === 'clock' || activeTab === 'metrics')
                        : activeTab === 'recent';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onTabChange(opt.id);
                          setIsTabDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp 
                            className="w-3.5 h-3.5" 
                            style={isSelected ? { color: themeColor } : undefined}
                          />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: themeColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Middle Buttons: Projects, Quarter's Weeks & Master Timesheet */}
          {/* Mobile: Evenly spaced between dropdown and settings. Desktop: Positioned right beside settings with full words */}
          <div className="flex items-center justify-evenly flex-1 sm:flex-initial sm:justify-end gap-1.5 sm:gap-2 sm:ml-auto">
            {/* Projects Button */}
            <button
              id="btn-open-projects"
              onClick={onOpenProjectsModal}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Projects & Session Notes"
              aria-label="Projects & Session Notes"
            >
              <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Projects</span>
            </button>

            {/* Quarter's Weeks Tracker Button */}
            <button
              id="btn-open-quarter-weeks"
              onClick={onOpenQuarterWeeksModal}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Quarter's Weeks Tracker & Breakdown"
              aria-label="Quarter's Weeks Tracker"
            >
              <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Quarter's Weeks</span>
            </button>

            {/* Master Timesheet Button */}
            <button
              id="btn-open-timesheet"
              onClick={onOpenTimesheetModal}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="Quarterly Master Timesheet"
              aria-label="Quarterly Master Timesheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Master Timesheet</span>
            </button>
          </div>

          {/* Pinned Settings Button on Right */}
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              id="btn-open-settings"
              onClick={onOpenSettingsModal}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              title="App Settings & Data Management"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
