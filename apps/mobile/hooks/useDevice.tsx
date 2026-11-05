import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAddress,
  deleteAddress,
  DeviceSettings,
  fetchAddresses,
  fetchSettings,
  registerDevice,
  SavedAddress,
  setDeviceToken,
  updateSettings,
} from "../services/api";
import { getExpoPushToken, getPushStatus, PushStatus, requestPushPermission } from "../services/notifications";

const TOKEN_KEY = "device_token_id";
const ONBOARDING_KEY = "onboarding_done";

interface DeviceState {
  // tokenId uređaja; null dok registracija ne uspije
  tokenId: string | null;
  pushStatus: PushStatus | null;
  // Traži dozvolu za push i veže Expo token na uređaj (KTD1)
  enablePush: () => Promise<PushStatus>;
  onboardingDone: boolean | null;
  finishOnboarding: () => Promise<void>;
}

const DeviceContext = createContext<DeviceState>({
  tokenId: null,
  pushStatus: null,
  enablePush: async () => "unavailable",
  onboardingDone: null,
  finishOnboarding: async () => {},
});

// Registruje uređaj pri prvom pokretanju, i bez dozvole za push (KTD1). Ponovna registracija sa
// sačuvanim tokenId-em vraća isti uređaj; ako ga server ne zna (npr. obrisani podaci), dobija se novi.
async function ensureDevice(): Promise<string> {
  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  setDeviceToken(stored);
  const expoToken = (await getExpoPushToken().catch(() => null)) ?? undefined;
  const { tokenId } = await registerDevice({ expoToken });
  setDeviceToken(tokenId);
  if (tokenId !== stored) await AsyncStorage.setItem(TOKEN_KEY, tokenId);
  return tokenId;
}

async function attachPushToken(): Promise<void> {
  const expoToken = await getExpoPushToken();
  if (expoToken) await registerDevice({ expoToken });
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const registration = useQuery({
    queryKey: ["device", "registration"],
    queryFn: ensureDevice,
    staleTime: Infinity,
    retry: true,
    retryDelay: (n) => Math.min(30_000, 1000 * 2 ** n),
  });
  const tokenId = registration.data ?? null;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingDone(v === "1"))
      .catch(() => setOnboardingDone(false));
  }, []);

  // Korisnik je mogao dozvoliti push u sistemskim podešavanjima: provjeri pri povratku u aplikaciju
  useEffect(() => {
    const refresh = async () => {
      const status = await getPushStatus();
      setPushStatus(status);
      if (status === "granted" && tokenId) await attachPushToken().catch(() => null);
    };
    refresh();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    return () => sub.remove();
  }, [tokenId]);

  const enablePush = useCallback(async () => {
    const status = await requestPushPermission();
    setPushStatus(status);
    if (status === "granted" && tokenId) await attachPushToken().catch(() => null);
    return status;
  }, [tokenId]);

  const finishOnboarding = useCallback(async () => {
    setOnboardingDone(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => null);
  }, []);

  return (
    <DeviceContext.Provider value={{ tokenId, pushStatus, enablePush, onboardingDone, finishOnboarding }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceState {
  return useContext(DeviceContext);
}

export function useDeviceSettings() {
  const { tokenId } = useDevice();
  const queryClient = useQueryClient();
  const key = ["device", tokenId, "settings"];

  const query = useQuery<DeviceSettings>({
    queryKey: key,
    queryFn: fetchSettings,
    enabled: !!tokenId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    // Prekidač reaguje odmah; greška vraća staro stanje
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DeviceSettings>(key);
      if (previous) queryClient.setQueryData<DeviceSettings>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  return { ...query, update: mutation.mutateAsync, updating: mutation.isPending };
}

export function useAddresses() {
  const { tokenId } = useDevice();
  const queryClient = useQueryClient();
  const key = ["device", tokenId, "addresses"];

  const query = useQuery<SavedAddress[]>({
    queryKey: key,
    queryFn: fetchAddresses,
    enabled: !!tokenId,
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: addAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { ...query, add: add.mutateAsync, adding: add.isPending, remove: remove.mutateAsync };
}
