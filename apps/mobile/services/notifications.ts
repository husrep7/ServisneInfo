import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { registerDevice } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(
  lat?: number,
  lng?: number
): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
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

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("komunalni", {
      name: "Komunalne obavijesti",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1a73e8",
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Register token with backend
  const { tokenId } = await registerDevice({ expoToken: token, lat, lng });
  await saveTokenId(tokenId);

  return tokenId;
}

// Simple AsyncStorage wrapper — in prod use SecureStore
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveTokenId(tokenId: string) {
  await AsyncStorage.setItem("device_token_id", tokenId);
}

export async function getTokenId(): Promise<string | null> {
  return AsyncStorage.getItem("device_token_id");
}
