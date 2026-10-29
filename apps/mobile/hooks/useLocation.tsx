import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Location from "expo-location";

interface UserLocation {
  lat: number;
  lng: number;
}

interface LocationState {
  location: UserLocation | null;
  permissionGranted: boolean;
  error: string | null;
}

const LocationContext = createContext<LocationState>({
  location: null,
  permissionGranted: false,
  error: null,
});

// Jedan GPS watcher za cijelu aplikaciju — ekrani čitaju lokaciju preko useLocation()
export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>({
    location: null,
    permissionGranted: false,
    error: null,
  });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setState((s) => ({ ...s, error: "Lokacijska dozvola odbijena. Neke funkcije neće raditi." }));
          return;
        }
        setState((s) => ({ ...s, permissionGranted: true }));

        // Get current position immediately
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setState((s) => ({ ...s, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));

        // Subscribe to significant location changes (battery-efficient)
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 500, // only fire when moved 500m+
            timeInterval: 300_000,  // or every 5 min
          },
          (p) => setState((s) => ({ ...s, location: { lat: p.coords.latitude, lng: p.coords.longitude } }))
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // npr. lokacijske usluge isključene na uređaju
        setState((s) => ({ ...s, error: "Lokacija trenutno nije dostupna." }));
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return <LocationContext.Provider value={state}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationState {
  return useContext(LocationContext);
}
