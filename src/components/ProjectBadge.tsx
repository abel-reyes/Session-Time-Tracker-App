import React from 'react';
import { Project } from '../types';

interface ProjectBadgeProps {
  name?: string;
  color?: string;
  project?: Project;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  title?: string;
}

export const ProjectBadge: React.FC<ProjectBadgeProps> = ({
  name,
  color,
  project,
  size = 'md',
  className = '',
  title,
}) => {
  const displayName = project?.name || name || 'Project';
  const displayColor = project?.color || color || '#64748b';

  const isXs = size === 'xs';
  const isSmall = size === 'sm';

  return (
    <span
      title={title || displayName}
      className={`inline-flex items-center gap-1.5 font-medium tracking-tight rounded-md border border-slate-200/90 bg-slate-50/90 text-slate-700 shadow-2xs shrink-0 ${
        isXs
          ? 'px-1.5 py-0.5 text-[9px]'
          : isSmall
          ? 'px-2 py-0.5 text-[10px]'
          : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      <span
        className={`${isXs ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full shrink-0`}
        style={{ backgroundColor: displayColor }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[140px] font-semibold">{displayName}</span>
    </span>
  );
};
