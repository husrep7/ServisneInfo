import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, TypeIcon } from '../components/Icon';
import { EmptyState, SkeletonList } from '../components/States';
import { typeStyle } from '../types';
import type { IncidentType } from '../types';

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="admin-page-head">
      <div>
        <h1 className="admin-page-title">{title}</h1>
        {sub && <p className="admin-page-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button className="btn secondary sm" onClick={onClick} disabled={loading}>
      <Icon name="refresh" size={15} /> Osvježi
    </button>
  );
}

export function TypeChip({ type }: { type: IncidentType }) {
  return <span className="admin-type-chip" style={typeStyle(type)}><TypeIcon type={type} size={19} /></span>;
}

export function Notice({ kind, children }: { kind: 'ok' | 'err'; children: ReactNode }) {
  return (
    <div className={`admin-notice ${kind}`} role="status">
      <Icon name={kind === 'ok' ? 'check' : 'alert'} size={17} /> {children}
    </div>
  );
}

export function LoadState({ loading, error, empty, emptyTitle = 'Nema stavki', onRetry }: {
  loading: boolean; error: string; empty: boolean; emptyTitle?: string; onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="admin-notice err" role="alert">
        <Icon name="alert" size={17} /> {error}
        <button className="admin-link-btn" onClick={onRetry}>Pokušaj ponovo</button>
      </div>
    );
  }
  if (loading) return <SkeletonList count={3} />;
  if (empty) return <div className="tile"><EmptyState title={emptyTitle} /></div>;
  return null;
}

// Potvrda radnje; zamjenjuje browserov confirm/prompt. withReason traži opcioni razlog
export function ConfirmDialog({ title, children, confirmLabel, withReason, onConfirm, onCancel }: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  withReason?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={ref} className="admin-dialog" onCancel={e => { e.preventDefault(); onCancel(); }}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); onConfirm(reason.trim()); }}>
        <h2 className="admin-dialog-title">{title}</h2>
        <p className="admin-dialog-text">{children}</p>
        {withReason && (
          <label>
            <span className="form-label">Razlog <span className="opt">(opciono)</span></span>
            <input className="field-input" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} />
          </label>
        )}
        <div className="admin-dialog-actions">
          <button type="button" className="btn secondary sm" onClick={onCancel}>Odustani</button>
          <button type="submit" className="btn danger sm">{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
