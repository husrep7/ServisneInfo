import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { reportLocation } from "../services/api";
import { getTokenId } from "../services/notifications";

interface UserLocation {
  lat: number;
  lng: number;
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAndWatch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Lokacijska dozvola odbijena. Neke funkcije neće raditi.");
      return;
    }
    setPermissionGranted(true);

    // Background permission for geofencing while app is in background
    await Location.requestBackgroundPermissionsAsync().catch(() => null);

    // Get current position immediately
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocation(loc);
    await sendLocationToServer(loc);

    // Subscribe to significant location changes (battery-efficient)
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 500, // only fire when moved 500m+
        timeInterval: 300_000,  // or every 5 min
      },
      async (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(newLoc);
        await sendLocationToServer(newLoc);
      }
    );
  }, []);

  useEffect(() => {
    requestAndWatch();
  }, [requestAndWatch]);

  return { location, permissionGranted, error };
}

async function sendLocationToServer(loc: UserLocation) {
  const tokenId = await getTokenId();
  if (!tokenId) return;
  await reportLocation({ tokenId, lat: loc.lat, lng: loc.lng }).catch(() => null);
}
