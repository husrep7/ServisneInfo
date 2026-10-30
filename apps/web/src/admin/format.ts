import type { ReportStatus } from './api';

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending:   'Na čekanju',
  confirmed: 'Potvrđene',
  rejected:  'Odbijene',
  expired:   'Istekle',
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('hr', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo',
  });
}

// Tekst prijava piše bilo ko — u Leaflet popupe ide samo kroz esc(), nikad kao sirovi HTML
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Jednina za oznaku na kartici (tabovi koriste množinu)
export const REPORT_STATUS_BADGE: Record<ReportStatus, string> = {
  pending:   'Na čekanju',
  confirmed: 'Potvrđena',
  rejected:  'Odbijena',
  expired:   'Istekla',
};
