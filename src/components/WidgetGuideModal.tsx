import { useState } from 'react';
import { 
  X, 
  Smartphone, 
  ExternalLink, 
  Check, 
  Copy, 
  Share2, 
  Play, 
  Square,
  Sparkles,
  Apple
} from 'lucide-react';

interface WidgetGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor?: string;
}

export function WidgetGuideModal({
  isOpen,
  onClose,
  themeColor = '#0284C7',
}: WidgetGuideModalProps) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const clockInUrl = `${currentOrigin}/?action=punch-in`;
  const clockOutUrl = `${currentOrigin}/?action=punch-out`;

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl max-w-lg sm:max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
                1-Tap Home Screen & Quick Actions
              </h3>
              <p className="text-xs text-slate-500">
                Setup direct 1-tap Clock In and Clock Out buttons on your phone
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
          {/* Method 1: 1-Tap Home Screen Icons */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Method 1: 1-Tap Home Screen Icons</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Add direct <strong>Clock In</strong> and <strong>Clock Out</strong> launcher icons straight to your phone&apos;s Home Screen. Tapping either icon instantly registers your punch:
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Clock In launcher */}
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Play className="w-3 h-3 fill-current" />
                    </span>
                    <span>1-Tap Clock In</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(clockInUrl, 'in')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedLink === 'in' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink === 'in' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={clockInUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open &amp; Add</span>
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Tap &quot;Open &amp; Add&quot;, then in Safari or Chrome select <strong>Share / 3-dots &rarr; &quot;Add to Home Screen&quot;</strong> and name it <strong>Clock In</strong>.
                </p>
              </div>

              {/* Clock Out launcher */}
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                    <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Square className="w-3 h-3 fill-current" />
                    </span>
                    <span>1-Tap Clock Out</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(clockOutUrl, 'out')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedLink === 'out' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink === 'out' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={clockOutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open &amp; Add</span>
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Tap &quot;Open &amp; Add&quot;, then in Safari or Chrome select <strong>Share / 3-dots &rarr; &quot;Add to Home Screen&quot;</strong> and name it <strong>Clock Out</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Method 2: iOS Apple Shortcuts (True Widget Buttons) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5 text-slate-700" />
                <span>Method 2: iOS Apple Shortcuts (Widgets &amp; Lock Screen)</span>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                iPhone
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If you want native widget buttons or lock screen widgets on iPhone:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-700 pl-0.5 leading-relaxed">
              <li>Open the built-in Apple <strong>Shortcuts</strong> app on your iPhone.</li>
              <li>Tap <strong>+</strong>, search for the action <strong>&quot;Open URLs&quot;</strong>, and paste the Clock In or Clock Out URL above.</li>
              <li>Name the shortcut <strong>&quot;Clock In&quot;</strong> (or &quot;Clock Out&quot;).</li>
              <li>On your iPhone Home Screen or Lock Screen, add the native <strong>Shortcuts Widget</strong> and choose your shortcut.</li>
            </ol>
          </div>

          {/* Method 3: Android App Icon Long-Press */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Method 3: Android App Icon Long-Press
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                Android
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Once the main app is added to your Android home screen, press and hold (long-press) the app icon to view native <strong>Clock In</strong> and <strong>Clock Out</strong> quick actions.
            </p>
          </div>

          {/* How to add to home screen helper box */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-950 space-y-1.5">
            <div className="font-bold text-[11px] uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-amber-700" />
              <span>How to add any link to Home Screen:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-900 leading-relaxed">
              <li><strong>iOS Safari:</strong> Tap the Share button (<Share2 className="w-3 h-3 inline" />) &rarr; Select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
              <li><strong>Android Chrome:</strong> Tap the three dots (<strong>⋮</strong>) &rarr; Select <strong>&quot;Add to Home screen&quot;</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 text-xs text-slate-500">
          <span>Shortcuts work directly on iOS & Android.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98"
            style={{ backgroundColor: themeColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
