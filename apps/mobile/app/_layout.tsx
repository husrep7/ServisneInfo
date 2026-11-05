import { Stack, router, useRootNavigationState } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { reportLocation } from "../services/api";
import { LocationProvider, useLocation } from "../hooks/useLocation";
import { DeviceProvider, useAddresses, useDevice, useDeviceSettings } from "../hooks/useDevice";
import { useIncidentUpdates } from "../hooks/useIncidents";
import { incidentPath } from "../constants/incident";

const queryClient = new QueryClient();

function AppInit() {
  const { tokenId } = useDevice();
  const { location } = useLocation();

  useIncidentUpdates();
  const openedFromNotification = useOpenIncidentFromNotification();
  useOnboardingRedirect(openedFromNotification);

  // Lokacija postoji samo dok je opcija uključena (LocationProvider), pa se tek tada i šalje (KTD11)
  useEffect(() => {
    if (!tokenId || !location) return;
    reportLocation({ lat: location.lat, lng: location.lng }).catch(() => null);
  }, [tokenId, location]);

  return null;
}

// Uvod se prikazuje dok uređaj nema nijednu adresu i korisnik ga nije završio ili preskočio
// skip: null dok se ne zna da li je aplikaciju otvorio tap na push
function useOnboardingRedirect(skip: boolean | null) {
  const { onboardingDone } = useDevice();
  const { data: addresses, isSuccess } = useAddresses();
  const navigationReady = !!useRootNavigationState()?.key;
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !navigationReady || onboardingDone === null || !isSuccess || skip === null) return;
    decided.current = true;
    if (!onboardingDone && !skip && addresses.length === 0) router.replace("/onboarding");
  }, [navigationReady, onboardingDone, isSuccess, addresses, skip]);
}

// Opcija lokacije dolazi iz postavki uređaja; dok se ne učitaju, lokacija je isključena
function LocationGate({ children }: { children: ReactNode }) {
  const { data: settings } = useDeviceSettings();
  return <LocationProvider enabled={settings?.locationEnabled ?? false}>{children}</LocationProvider>;
}

// Tap na push otvara prekid (push nosi data.incidentId). useLastNotificationResponse vraća
// i tap koji je pokrenuo zatvorenu aplikaciju, pa čekamo da navigator bude spreman.
// Vraća null dok expo-notifications ne zna da li postoji tap, pa true/false
function useOpenIncidentFromNotification(): boolean | null {
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

  return response === undefined ? null : !!response;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DeviceProvider>
        <LocationGate>
          <AppInit />
          <Stack screenOptions={{ headerShown: false }} />
        </LocationGate>
      </DeviceProvider>
    </QueryClientProvider>
  );
}
