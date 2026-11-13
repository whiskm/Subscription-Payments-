import type { ReactNode } from 'react';
import { back } from '../state/router';
import { useApp } from '../state/app';
import { IconButton } from './ui';

/** Large title for the main tabs. */
export function TopBar({ kicker, title, actions }: { kicker?: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <header className="top">
      <div style={{ minWidth: 0 }}>
        {kicker && <div className="mono">{kicker}</div>}
        {/* Long words (such as "Subscription") get a slightly smaller size so they never break mid-word. */}
        <h1 className="top__title" data-long={title.split(/\s+/).some((w) => w.length >= 11) ? '' : undefined}>
          {title}
        </h1>
      </div>
      {actions && <div className="top__actions">{actions}</div>}
    </header>
  );
}

/** Compact bar with a back button for inner screens. */
export function BackBar({ title, fallback = '/', actions }: { title?: string; fallback?: string; actions?: ReactNode }) {
  const { t } = useApp();
  return (
    <header className="bar">
      <IconButton icon="back" label={t('common.back')} onClick={() => back(fallback)} />
      <div className="bar__title">{title}</div>
      {actions ?? <span style={{ width: 44 }} />}
    </header>
  );
}
