import React from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmModalProps {
  options: ConfirmDialogOptions | null;
  onClose: () => void;
  themeColor?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  options,
  onClose,
  themeColor = '#059669',
}) => {
  if (!options) return null;

  const isDanger = options.variant === 'danger';
  const isWarning = options.variant === 'warning';

  const confirmBgClass = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-700/20'
    : isWarning
    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-700/20'
    : '';

  const confirmStyle = (!isDanger && !isWarning) ? { backgroundColor: themeColor } : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col scale-in-95 duration-150 animate-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDanger
                ? 'bg-rose-50 border-rose-200/80 text-rose-600'
                : isWarning
                ? 'bg-amber-50 border-amber-200/80 text-amber-600'
                : 'bg-emerald-50 border-emerald-200/80 text-emerald-600'
            }`}
          >
            {isDanger || isWarning ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <HelpCircle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1 pt-0.5">
            <h3 className="font-bold text-sm text-slate-900 leading-snug">
              {options.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {options.message}
            </p>
          </div>
        </div>

        {/* Standardized Sticky Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (options.onCancel) options.onCancel();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              options.onConfirm();
              onClose();
            }}
            style={confirmStyle}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 ${confirmBgClass}`}
          >
            {options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
