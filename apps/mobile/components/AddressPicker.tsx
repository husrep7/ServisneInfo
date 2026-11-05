import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors } from "../constants/colors";
import { isAddressLimit, MAX_ADDRESSES } from "../services/api";
import { useAddresses } from "../hooks/useDevice";
import { AddressSearch, Pin, PinMap } from "./AddressSearch";

const LABELS = ["Kuća", "Posao", "Roditelji"];

// Upis adrese → rezultat pretrage → potvrda ili pomjeranje pina → oznaka (KTD12).
// Bez rezultata korisnik sam postavlja pin na mapi.
export function AddressPicker({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const { add, adding } = useAddresses();
  const [pin, setPin] = useState<Pin | null>(null);
  const [label, setLabel] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!pin) return;
    setSaveError(null);
    try {
      await add({ label: label.trim(), address: pin.address, lat: pin.lat, lng: pin.lng });
      onSaved();
    } catch (err) {
      setSaveError(
        isAddressLimit(err)
          ? `Možete sačuvati najviše ${MAX_ADDRESSES} adresa. Obrišite jednu u Postavkama pa dodajte novu.`
          : "Čuvanje nije uspjelo. Pokušajte ponovo."
      );
    }
  };

  if (!pin) {
    return (
      <View style={styles.wrap}>
        <AddressSearch onSelect={setPin} />
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.linkBtn} accessibilityRole="button">
            <Text style={styles.link}>Odustani</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <PinMap pin={pin} onMove={setPin} />

      <Text style={styles.fieldLabel}>Naziv adrese</Text>
      <View style={styles.chips}>
        {LABELS.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, label === l && styles.chipActive]}
            onPress={() => setLabel(l)}
            accessibilityRole="button"
            accessibilityState={{ selected: label === l }}
          >
            <Text style={[styles.chipText, label === l && styles.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="npr. Kuća"
        maxLength={40}
        accessibilityLabel="Naziv adrese"
      />

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <TouchableOpacity
        style={[styles.button, (!label.trim() || adding) && styles.buttonDisabled]}
        onPress={save}
        disabled={!label.trim() || adding}
        accessibilityRole="button"
      >
        {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sačuvaj adresu</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setPin(null); setSaveError(null); }} style={styles.linkBtn} accessibilityRole="button">
        <Text style={styles.link}>Nazad na pretragu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  error: { fontSize: 14, color: Colors.live },
  fieldLabel: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 1, marginTop: 4 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.divider },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
});
