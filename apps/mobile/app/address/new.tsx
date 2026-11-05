import React from "react";
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Colors } from "../../constants/colors";
import { AddressPicker } from "../../components/AddressPicker";

export default function NewAddressScreen() {
  const close = () => (router.canGoBack() ? router.back() : router.replace("/settings"));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.header}>
        <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Nazad">
          <Text style={styles.back}>‹ Nazad</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>NOVA ADRESA</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AddressPicker onSaved={close} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.navy,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 16, fontWeight: "600" },
  headerLabel: { fontSize: 10, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 2 },
  content: { padding: 16, paddingBottom: 40 },
});
