import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';

export default function NotFound() {
  return (
    <div className="page" style={{ paddingTop: 60 }}>
      <EmptyState icon="map" tone="neutral" title="Stranica nije pronađena"
        action={<Link to="/" className="btn primary">Idi na početnu</Link>}>
        Link je možda zastario ili pogrešno upisan.
      </EmptyState>
    </div>
  );
}
