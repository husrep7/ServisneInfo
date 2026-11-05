import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Colors } from "../constants/colors";

// Dugme "Prijavi kvar" na tabovima lista i mapa (U8/U9)
export function ReportButton({ style }: { style?: object }) {
  return (
    <TouchableOpacity
      style={[styles.fab, style]}
      onPress={() => router.push("/report")}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Prijavi kvar"
    >
      <Text style={styles.text}>＋ Prijavi kvar</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    backgroundColor: Colors.live,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
