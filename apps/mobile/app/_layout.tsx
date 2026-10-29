import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { registerForPushNotifications } from "../services/notifications";
import { reportLocation } from "../services/api";
import { LocationProvider, useLocation } from "../hooks/useLocation";
import { useIncidentUpdates } from "../hooks/useIncidents";

const queryClient = new QueryClient();

function AppInit() {
  const { location } = useLocation();
  const [tokenId, setTokenId] = useState<string | null>(null);

  useIncidentUpdates();

  useEffect(() => {
    registerForPushNotifications()
      .then(setTokenId)
      .catch((err) => console.warn("Push registration failed:", err));
  }, []);

  // Šalji lokaciju tek kad imamo i token i lokaciju (bez obzira šta stigne prvo)
  useEffect(() => {
    if (!tokenId || !location) return;
    reportLocation({ tokenId, lat: location.lat, lng: location.lng }).catch(() => null);
  }, [tokenId, location]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <AppInit />
        <Stack screenOptions={{ headerShown: false }} />
      </LocationProvider>
    </QueryClientProvider>
  );
}
