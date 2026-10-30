import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';

export function PageHeader({ title, eyebrow, back, aside, narrow }: {
  title: string;
  eyebrow?: ReactNode;
  back?: boolean;
  aside?: ReactNode;
  narrow?: boolean;
}) {
  const navigate = useNavigate();
  // Direktno otvoren link nema historiju — tada nazad vodi na početnu
  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'));

  return (
    <header className="page-header">
      <div className={`container page-header-inner${narrow ? ' narrow' : ''}`}>
        {back && (
          <button className="icon-btn back-btn" onClick={goBack} aria-label="Nazad">
            <Icon name="back" size={18} />
          </button>
        )}
        <div className="page-header-text">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
        </div>
        {aside && <div className="page-header-aside">{aside}</div>}
      </div>
    </header>
  );
}
