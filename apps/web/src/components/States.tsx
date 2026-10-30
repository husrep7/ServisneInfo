import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function EmptyState({ icon = 'check', tone = 'ok', title, children, action }: {
  icon?: IconName;
  tone?: 'ok' | 'warn' | 'neutral';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className={`empty-icon${tone === 'ok' ? '' : ` ${tone}`}`}><Icon name={icon} size={26} /></div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-sub">{children}</div>}
      {action}
    </div>
  );
}

// Kad API ne odgovara — ne smijemo reći "sve je u redu" jer to ne znamo
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState icon="alert" tone="warn" title="Podaci trenutno nisu dostupni"
      action={<button className="btn secondary" onClick={onRetry}><Icon name="refresh" size={16} /> Pokušaj ponovo</button>}>
      Ne možemo dohvatiti obavijesti o prekidima. Provjerite internet vezu ili pokušajte malo kasnije.
    </EmptyState>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Učitavanje">
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}
