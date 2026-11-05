import { Stack, router, useRootNavigationState } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { registerForPushNotifications } from "../services/notifications";
import { reportLocation } from "../services/api";
import { LocationProvider, useLocation } from "../hooks/useLocation";
import { useIncidentUpdates } from "../hooks/useIncidents";
import { incidentPath } from "../constants/incident";

const queryClient = new QueryClient();

function AppInit() {
  const { location } = useLocation();
  const [tokenId, setTokenId] = useState<string | null>(null);

  useIncidentUpdates();
  useOpenIncidentFromNotification();

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

// Tap na push otvara prekid (push nosi data.incidentId). useLastNotificationResponse vraća
// i tap koji je pokrenuo zatvorenu aplikaciju, pa čekamo da navigator bude spreman.
function useOpenIncidentFromNotification() {
  const response = Notifications.useLastNotificationResponse();
  const navigationReady = !!useRootNavigationState()?.key;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!navigationReady || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const requestId = response.notification.request.identifier;
    if (handled.current === requestId) return;
    handled.current = requestId;

    const incidentId = response.notification.request.content.data?.incidentId;
    if (typeof incidentId === "string" && incidentId) router.push(incidentPath(incidentId));
  }, [navigationReady, response]);
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
