import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { registerDevice } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  // Android 13+: dijalog za dozvolu se ne prikazuje dok ne postoji bar jedan kanal
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("servisneinfo", {
      name: "Komunalne obavijesti",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1a73e8",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission denied");
    return null;
  }

  // SDK 51 zahtijeva EAS projectId (app.json → extra.eas.projectId, postavlja `eas init`)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("Missing EAS projectId — push notifications disabled");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  // Register token with backend
  const { tokenId } = await registerDevice({ expoToken: token });
  await saveTokenId(tokenId);

  return tokenId;
}

export async function saveTokenId(tokenId: string) {
  await AsyncStorage.setItem("device_token_id", tokenId);
}

export async function getTokenId(): Promise<string | null> {
  return AsyncStorage.getItem("device_token_id");
}
