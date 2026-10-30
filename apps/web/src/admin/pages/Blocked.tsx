import { useState } from 'react';
import { errorText, listBlocked, unblock, type BlockedReporter } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle } from '../components';

export default function Blocked() {
  const { data, error, loading, reload } = useLoad(listBlocked);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function onUnblock(b: BlockedReporter) {
    if (!window.confirm('Deblokirati ovog prijavioca? Nove prijave će ponovo biti javne.')) return;
    setBusy(b.reporter_key);
    try {
      await unblock(b.reporter_key);
      setNotice('');
      await reload();
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const blocked = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Blokirani prijavioci" />
      {notice && <div className="admin-error" role="alert">{notice}</div>}
      <LoadState loading={loading && !data} error={error} empty={!!data && blocked.length === 0} onRetry={reload} />

      {blocked.length > 0 && (
        <ul className="admin-rows">
          {blocked.map(b => (
            <li key={b.reporter_key}>
              <span className="admin-row-main">
                <code className="admin-key">{b.reporter_key}</code>
                <span className="admin-muted"> · {b.reason || 'bez razloga'} · {b.reports} prijava · od {fmtDateTime(b.created_at)}</span>
              </span>
              <button className="admin-btn" disabled={busy === b.reporter_key} onClick={() => onUnblock(b)}>Deblokiraj</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
