import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty" style={{ paddingTop: 100 }}>
        <div className="empty-icon">🧭</div>
        <div className="empty-title">Stranica nije pronađena</div>
        <div className="empty-sub" style={{ marginBottom: 24 }}>Link je možda zastario ili pogrešno upisan.</div>
        <Link to="/" style={{ color: 'var(--primary)', fontWeight: 700 }}>Idi na početnu</Link>
      </div>
    </div>
  );
}
