import { Tabs } from "expo-router";
import { Text, Platform } from "react-native";
import { Colors } from "../../constants/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 80 : 60,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Obavijesti",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji={focused ? "📋" : "📄"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Karta",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji={focused ? "🗺️" : "🗺️"} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 22, opacity: color === Colors.primary ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}
