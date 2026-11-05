import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Colors } from "../../constants/colors";
import { MAX_ADDRESSES } from "../../services/api";
import { useAddresses, useDevice } from "../../hooks/useDevice";
import { LocationToggle, PushBanner, ReminderPicker, TypeToggles } from "../../components/SettingsControls";

export default function SettingsScreen() {
  const { tokenId } = useDevice();
  const { data: addresses = [], isLoading, isError, refetch, remove } = useAddresses();
  const full = addresses.length >= MAX_ADDRESSES;

  const confirmDelete = (id: string, label: string) =>
    Alert.alert("Obriši adresu", `Obrisati adresu "${label}"? Za nju više nećete dobijati obavijesti.`, [
      { text: "Odustani", style: "cancel" },
      { text: "Obriši", style: "destructive", onPress: () => remove(id).catch(() => null) },
    ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.header}>
        <Text style={styles.headerLabel}>POSTAVKE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PushBanner />

        <Section title={`Moje adrese · ${addresses.length}/${MAX_ADDRESSES}`}>
          {!tokenId || isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : isError ? (
            <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
              <Text style={styles.error}>Adrese se nisu učitale. Dodirnite za ponovni pokušaj.</Text>
            </TouchableOpacity>
          ) : (
            <>
              {addresses.length === 0 && (
                <Text style={styles.muted}>Dodajte adresu da dobijete obavijest kad prekid pogodi vašu ulicu.</Text>
              )}
              {addresses.map((a) => (
                <View key={a.id} style={styles.addressRow}>
                  <View style={styles.addressText}>
                    <Text style={styles.addressLabel}>{a.label}</Text>
                    <Text style={styles.addressValue} numberOfLines={1}>{a.address}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(a.id, a.label)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Obriši adresu ${a.label}`}
                  >
                    <Text style={styles.delete}>Obriši</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {full ? (
                <Text style={styles.muted}>
                  Sačuvali ste najviše {MAX_ADDRESSES} adresa. Obrišite jednu da dodate novu.
                </Text>
              ) : (
                <TouchableOpacity style={styles.button} onPress={() => router.push("/address/new")} accessibilityRole="button">
                  <Text style={styles.buttonText}>+ Dodaj adresu</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Section>

        <Section title="Lokacija">
          <LocationToggle />
        </Section>

        <Section title="Podsjetnik">
          <ReminderPicker />
        </Section>

        <Section title="Obavijesti po usluzi">
          <Text style={styles.muted}>Isključena usluga se i dalje vidi u listi, samo ne šaljemo obavijest.</Text>
          <TypeToggles />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
  },
  headerLabel: { fontSize: 10, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 2 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 1, textTransform: "uppercase" },
  card: { backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  muted: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 6 },
  error: { fontSize: 14, color: Colors.live, paddingVertical: 6 },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  addressText: { flex: 1 },
  addressLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
  addressValue: { fontSize: 13, color: Colors.textSecondary },
  delete: { color: Colors.live, fontSize: 14, fontWeight: "600" },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginVertical: 8 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
