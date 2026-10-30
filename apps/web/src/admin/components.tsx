import type { ReactNode } from 'react';

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="admin-page-head">
      <h1 className="admin-page-title">{title}</h1>
      {children}
    </div>
  );
}

export function LoadState({ loading, error, empty, onRetry }: {
  loading: boolean; error: string; empty: boolean; onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="admin-error" role="alert">
        {error} <button className="admin-link-btn" onClick={onRetry}>Pokušaj ponovo</button>
      </div>
    );
  }
  if (loading) return <div className="admin-muted">Učitavanje…</div>;
  if (empty) return <div className="admin-empty">Nema stavki.</div>;
  return null;
}
