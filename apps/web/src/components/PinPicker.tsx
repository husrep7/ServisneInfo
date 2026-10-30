import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng { lat: number; lng: number }

const SARAJEVO: L.LatLngTuple = [43.856, 18.413];

const pinIcon = L.divIcon({
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  html: '<div class="marker-pin pin-pick"><span></span></div>',
});

// Mapa na kojoj korisnik klikom ili prevlačenjem postavlja/pomjera pin (KTD12)
export function PinPicker({ value, onChange, label = 'Mapa za odabir lokacije' }: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(SARAJEVO, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true })
        .on('dragend', () => {
          const p = marker.current!.getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        })
        .addTo(m);
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
    if (!m.getBounds().pad(-0.2).contains([value.lat, value.lng])) {
      m.setView([value.lat, value.lng], Math.max(m.getZoom(), 16));
    }
  }, [value]);

  return <div ref={el} className="pin-map" role="application" aria-label={label} />;
}
