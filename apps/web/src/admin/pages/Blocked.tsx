import { useState } from 'react';
import { errorText, listBlocked, unblock, type BlockedReporter } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { ConfirmDialog, LoadState, Notice, PageTitle } from '../components';
import { Icon } from '../../components/Icon';

export default function Blocked() {
  const { data, error, loading, reload } = useLoad(listBlocked);
  const [busy, setBusy] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<BlockedReporter | null>(null);
  const [notice, setNotice] = useState('');

  async function onUnblock(b: BlockedReporter) {
    setUnblocking(null);
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
      <PageTitle title="Blokirani prijavioci" sub="Njihove nove prijave se tiho odbacuju" />
      {notice && <Notice kind="err">{notice}</Notice>}
      <LoadState loading={loading && !data} error={error} empty={!!data && blocked.length === 0} emptyTitle="Niko nije blokiran" onRetry={reload} />

      {blocked.length > 0 && (
        <ul className="tile admin-rows">
          {blocked.map(b => (
            <li key={b.reporter_key}>
              <span className="admin-icon-chip"><Icon name="ban" size={19} /></span>
              <span className="admin-row-main">
                <code className="admin-key">{b.reporter_key}</code>
                <span className="admin-muted">{b.reason || 'bez razloga'} · {b.reports} prijava · od {fmtDateTime(b.created_at)}</span>
              </span>
              <button className="btn secondary sm" disabled={busy === b.reporter_key} onClick={() => setUnblocking(b)}>Deblokiraj</button>
            </li>
          ))}
        </ul>
      )}

      {unblocking && (
        <ConfirmDialog title="Deblokirati prijavioca?" confirmLabel="Deblokiraj"
          onConfirm={() => onUnblock(unblocking)} onCancel={() => setUnblocking(null)}>
          Nove prijave će ponovo biti javne.
        </ConfirmDialog>
      )}
    </div>
  );
}
