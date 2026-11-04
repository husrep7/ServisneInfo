// Lokacija korisnika (ADR-0004): GPS iz browsera čim se otvori početna, sa ručnom lokacijom
// (pretraga ulice ili sačuvana adresa) kad GPS nije dozvoljen ili korisnik želi drugo mjesto.
import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoStatus = 'asking' | 'ok' | 'denied' | 'unavailable';

export interface GeoPoint {
  lat:       number;
  lng:       number;
  accuracy?: number;   // metara, samo za GPS
  label?:    string;   // za ručno izabranu lokaciju
  source:    'gps' | 'manual';
}

// Pomak manji od ovoga ne mijenja lokaciju (GPS "skakuće" i bez kretanja)
const MIN_MOVE_M = 40;

function moved(a: GeoPoint, b: GeoPoint): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'asking' : 'unavailable');
  const [gps, setGps]       = useState<GeoPoint | null>(null);
  const [manual, setManual] = useState<GeoPoint | null>(null);
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) { setStatus('unavailable'); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setStatus(s => (s === 'ok' ? s : 'asking'));
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const next: GeoPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, source: 'gps' };
        setGps(prev => (prev && moved(prev, next) < MIN_MOVE_M ? { ...prev, accuracy: next.accuracy } : next));
        setStatus('ok');
      },
      err => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  }, []);

  useEffect(() => {
    start();
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [start]);

  const chooseManual = useCallback((p: { lat: number; lng: number; label: string } | null) => {
    setManual(p ? { ...p, source: 'manual' } : null);
  }, []);

  return { status, point: manual ?? gps, gps, manual, retry: start, setManual: chooseManual };
}
