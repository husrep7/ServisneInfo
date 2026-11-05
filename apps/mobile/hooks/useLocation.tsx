import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Location from "expo-location";

interface UserLocation {
  lat: number;
  lng: number;
}

interface LocationState {
  location: UserLocation | null;
  // Opcija "lokacija" je uključena u postavkama uređaja
  enabled: boolean;
  error: string | null;
}

const LocationContext = createContext<LocationState>({
  location: null,
  enabled: false,
  error: null,
});

// Traži dozvolu za lokaciju; zove se samo kad korisnik uključi opciju (KTD11)
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

// Jedan GPS watcher za cijelu aplikaciju — ekrani čitaju lokaciju preko useLocation().
// Dok je opcija isključena, ne traži dozvolu i ne prati lokaciju (KTD11).
export function LocationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!enabled) {
      setLocation(null);
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Samo provjera: dozvolu traži prekidač u Postavkama ili uvodu
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Lokacija je uključena, ali aplikacija nema dozvolu. Dozvolite je u sistemskim podešavanjima.");
          return;
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });

        // Samo značajne promjene (štedi bateriju)
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 500,
            timeInterval: 300_000,
          },
          (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude })
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // npr. lokacijske usluge isključene na uređaju
        if (!cancelled) setError("Lokacija trenutno nije dostupna.");
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return (
    <LocationContext.Provider value={{ location: enabled ? location : null, enabled, error }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationState {
  return useContext(LocationContext);
}
