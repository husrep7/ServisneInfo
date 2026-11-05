import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Colors } from "../constants/colors";
import { useAddresses, useDevice } from "../hooks/useDevice";
import { AddressPicker } from "../components/AddressPicker";
import { LocationToggle, TypeToggles } from "../components/SettingsControls";

type Step = "push" | "address" | "location" | "types";
const STEPS: Step[] = ["push", "address", "location", "types"];

// Uvod pri prvom pokretanju (F1): dozvola za push, adresa, lokacija, usluge.
// Svaki korak se može preskočiti; odbijen push ne zaustavlja uvod.
export default function OnboardingScreen() {
  const { enablePush, finishOnboarding } = useDevice();
  const { data: addresses = [] } = useAddresses();
  const [step, setStep] = useState<Step>("push");
  const [addingAddress, setAddingAddress] = useState(true);

  const index = STEPS.indexOf(step);
  const next = () => (index < STEPS.length - 1 ? setStep(STEPS[index + 1]) : finish());
  const finish = async () => {
    await finishOnboarding();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.header}>
        <Text style={styles.headerLabel}>DOBRO DOŠLI · {index + 1}/{STEPS.length}</Text>
        <TouchableOpacity onPress={finish} accessibilityRole="button" accessibilityLabel="Preskoči uvod">
          <Text style={styles.skipAll}>Preskoči uvod</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === "push" && (
          <>
            <Text style={styles.title}>Obavijest kad nestane vode ili struje</Text>
            <Text style={styles.text}>
              Javimo vam čim preduzeće objavi prekid na vašoj adresi, podsjetimo vas prije početka i javimo kad prekid počne.
            </Text>
            <Primary label="Dozvoli obavijesti" onPress={async () => { await enablePush(); next(); }} />
            <Secondary label="Ne sada" onPress={next} />
          </>
        )}

        {step === "address" && (
          <>
            <Text style={styles.title}>Koja adresa vas zanima?</Text>
            <Text style={styles.text}>Kuća, posao ili roditelji. Možete sačuvati do 5 adresa, i kasnije ih mijenjati u Postavkama.</Text>
            {addresses.length > 0 && (
              <View style={styles.saved}>
                {addresses.map((a) => (
                  <Text key={a.id} style={styles.savedText}>✓ {a.label}: {a.address}</Text>
                ))}
              </View>
            )}
            {addingAddress ? (
              <AddressPicker onSaved={() => setAddingAddress(false)} />
            ) : (
              <Secondary label="+ Dodaj još jednu adresu" onPress={() => setAddingAddress(true)} />
            )}
            {addresses.length > 0 ? <Primary label="Dalje" onPress={next} /> : <Secondary label="Preskoči" onPress={next} />}
          </>
        )}

        {step === "location" && (
          <>
            <Text style={styles.title}>Obavijesti i po lokaciji?</Text>
            <Text style={styles.text}>
              Ako uključite, javimo vam i za prekid tamo gdje se trenutno nalazite. Lokacija se šalje samo dok je ova opcija uključena.
            </Text>
            <View style={styles.card}><LocationToggle /></View>
            <Primary label="Dalje" onPress={next} />
          </>
        )}

        {step === "types" && (
          <>
            <Text style={styles.title}>Za koje usluge želite obavijesti?</Text>
            <Text style={styles.text}>Sve prekide i dalje vidite u listi; isključena usluga samo ne šalje obavijest.</Text>
            <View style={styles.card}><TypeToggles /></View>
            <Primary label="Završi" onPress={finish} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondary} onPress={onPress} accessibilityRole="button">
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
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
  headerLabel: { fontSize: 10, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 2 },
  skipAll: { color: "#fff", fontSize: 14, fontWeight: "600" },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, lineHeight: 28 },
  text: { fontSize: 15, color: Colors.textSecondary, lineHeight: 21 },
  card: { backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  saved: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, gap: 4 },
  savedText: { fontSize: 14, color: Colors.text },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { color: Colors.primary, fontSize: 15, fontWeight: "600" },
});
