import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushStatus = "granted" | "denied" | "undetermined" | "unavailable";

async function ensureAndroidChannel() {
  // Android 13+: dijalog za dozvolu se ne prikazuje dok ne postoji bar jedan kanal
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("servisneinfo", {
      name: "Komunalne obavijesti",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1a73e8",
    });
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushStatus;
}

// Traži dozvolu samo kad je korisnik pita (uvod ili Postavke), nikad pri startu
export async function requestPushPermission(): Promise<PushStatus> {
  if (!Device.isDevice) return "unavailable";
  await ensureAndroidChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PushStatus;
}

// Expo push token kad je dozvola već data; null bez dozvole ili bez EAS projectId-a
export async function getExpoPushToken(): Promise<string | null> {
  if ((await getPushStatus()) !== "granted") return null;
  await ensureAndroidChannel();

  // SDK 51 zahtijeva EAS projectId (app.json → extra.eas.projectId, postavlja `eas init`)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("Missing EAS projectId — push notifications disabled");
    return null;
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
