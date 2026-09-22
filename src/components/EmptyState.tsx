import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  themeColor?: string;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
  themeColor = '#059669',
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 ${
        compact ? 'py-5 px-4' : 'py-8 px-6'
      } ${className}`}
    >
      <div
        className={`rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center text-slate-400 ${
          compact ? 'w-9 h-9 mb-2.5' : 'w-12 h-12 mb-3.5'
        }`}
      >
        <Icon className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
      </div>
      <h4 className={`font-bold text-slate-800 tracking-tight ${compact ? 'text-xs' : 'text-sm'}`}>
        {title}
      </h4>
      {description && (
        <p
          className={`text-slate-500 font-normal mt-1 max-w-sm leading-relaxed ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs transition-all hover:opacity-90 active:scale-98 cursor-pointer"
          style={{ backgroundColor: themeColor }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
