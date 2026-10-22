import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchIncidents } from '../api';
import { IncidentRow } from '../components/IncidentRow';
import type { Incident, IncidentType } from '../types';
import { COMPANIES, TYPE_COLOR } from '../types';

export default function IncidentList() {
  const [params, setParams]       = useSearchParams();
  const filter = (params.get('type') ?? 'all') as IncidentType | 'all';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    const data = await fetchIncidents({ limit: 100 });
    data.sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : new Date(a.created_at).getTime();
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : new Date(b.created_at).getTime();
      return tb - ta;
    });
    setIncidents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = incidents
    .filter(i => filter === 'all' || i.type === filter)
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.affected_addresses?.some(a => a.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="page">
      <div className="s-header" style={{ paddingBottom: 20 }}>
        <div className="s-header-title" style={{ fontSize: 20 }}>Sve obavijesti</div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <span>🔍</span>
        <input className="search-input" placeholder="Pretraži obavijesti..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} style={{ color: '#C4C4C4', fontSize: 18 }}>✕</button>}
      </div>

      {/* Company filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <button onClick={() => setParams({})} style={{
          flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: filter === 'all' ? '#323B54' : '#F8F9FA',
          color: filter === 'all' ? '#fff' : '#949AA9',
          border: `1.5px solid ${filter === 'all' ? '#323B54' : '#F0F0F0'}`,
          cursor: 'pointer', fontFamily: 'Quicksand, sans-serif',
        }}>
          Sve ({incidents.length})
        </button>

        {COMPANIES.map(c => {
          const isActive = filter === c.type;
          const cnt = incidents.filter(i => i.type === c.type).length;
          return (
            <button key={c.id} onClick={() => setParams({ type: c.type })} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px 5px 5px', borderRadius: 20, cursor: 'pointer',
              border: `1.5px solid ${isActive ? TYPE_COLOR[c.type] : '#F0F0F0'}`,
              background: isActive ? `${TYPE_COLOR[c.type]}15` : '#F8F9FA',
              fontFamily: 'Quicksand, sans-serif',
            }}>
              <div style={{ width: 24, height: 24, borderRadius: 12, background: c.logoBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={c.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? TYPE_COLOR[c.type] : '#323B54' }}>
                {c.shortName}
              </span>
              <span style={{ fontSize: 11, color: '#949AA9' }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      <div className="s-section">
        <span className="s-section-title">{filtered.length} obavijesti</span>
      </div>

      {loading ? (
        <div className="spinner"><div className="spinner-ring" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">✅</div>
          <div className="empty-title">{search ? 'Nema rezultata' : 'Nema obavijesti'}</div>
          <div className="empty-sub">{search ? `Nema rezultata za "${search}".` : 'Nema aktivnih poremećaja u ovoj kategoriji.'}</div>
        </div>
      ) : (
        filtered.map(i => <IncidentRow key={i.id} incident={i} />)
      )}
    </div>
  );
}
