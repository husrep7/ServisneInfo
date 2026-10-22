import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { registerForPushNotifications } from "../services/notifications";
import { useLocation } from "../hooks/useLocation";

const queryClient = new QueryClient();

function AppInit() {
  const { location } = useLocation();

  useEffect(() => {
    registerForPushNotifications(location?.lat, location?.lng);
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInit />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
