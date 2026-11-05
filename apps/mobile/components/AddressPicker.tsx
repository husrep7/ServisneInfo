import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Colors } from "../constants/colors";
import { AddressMatch, isAddressLimit, isTooManyRequests, MAX_ADDRESSES, searchAddress } from "../services/api";
import { useAddresses } from "../hooks/useDevice";

const SARAJEVO = { lat: 43.8563, lng: 18.4131 };
const LABELS = ["Kuća", "Posao", "Roditelji"];

type Search =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "results"; matches: AddressMatch[] }
  | { state: "none" }
  | { state: "error"; message: string };

interface Pin {
  lat: number;
  lng: number;
  address: string;
}

// Upis adrese → rezultat pretrage → potvrda ili pomjeranje pina → oznaka (KTD12).
// Bez rezultata korisnik sam postavlja pin na mapi.
export function AddressPicker({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const { add, adding } = useAddresses();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [pin, setPin] = useState<Pin | null>(null);
  const [label, setLabel] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearch({ state: "error", message: "Upišite bar 3 znaka." });
      return;
    }
    setSearch({ state: "loading" });
    try {
      const matches = await searchAddress(q);
      setSearch(matches.length ? { state: "results", matches } : { state: "none" });
    } catch (err) {
      setSearch({
        state: "error",
        message: isTooManyRequests(err)
          ? "Pretraga je trenutno zauzeta. Pokušajte ponovo za minut."
          : "Pretraga nije uspjela. Provjerite internet vezu i pokušajte ponovo.",
      });
    }
  };

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

  if (pin) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>Povucite pin ili dodirnite mapu da označite tačno mjesto.</Text>
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ latitude: pin.lat, longitude: pin.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
            onPress={(e) => setPin({ ...pin, lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          >
            <Marker
              draggable
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              onDragEnd={(e) => setPin({ ...pin, lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
            />
          </MapView>
        </View>
        <Text style={styles.address} numberOfLines={2}>{pin.address}</Text>

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

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder="Ulica i broj, npr. Ferhadija 12"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Adresa"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} accessibilityRole="button" accessibilityLabel="Traži adresu">
          <Text style={styles.buttonText}>Traži</Text>
        </TouchableOpacity>
      </View>

      {search.state === "loading" && <ActivityIndicator color={Colors.primary} style={styles.loading} />}

      {search.state === "results" && search.matches.map((m) => (
        <TouchableOpacity
          key={`${m.lat},${m.lng}`}
          style={styles.result}
          onPress={() => setPin({ lat: m.lat, lng: m.lng, address: m.label })}
          accessibilityRole="button"
        >
          <Text style={styles.resultText}>📍 {m.label}</Text>
        </TouchableOpacity>
      ))}

      {search.state === "none" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Adresa nije pronađena u Kantonu Sarajevo.</Text>
          <TouchableOpacity
            onPress={() => setPin({ ...SARAJEVO, address: query.trim() })}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Postavi pin na mapi sam</Text>
          </TouchableOpacity>
        </View>
      )}

      {search.state === "error" && (
        <View style={styles.notice}>
          <Text style={styles.error}>{search.message}</Text>
          {query.trim().length >= 3 && (
            <TouchableOpacity onPress={runSearch} accessibilityRole="button">
              <Text style={styles.link}>Pokušaj ponovo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {onCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.linkBtn} accessibilityRole="button">
          <Text style={styles.link}>Odustani</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: { flex: 1 },
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
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  loading: { marginVertical: 12 },
  result: { backgroundColor: Colors.card, borderRadius: 12, padding: 14 },
  resultText: { fontSize: 14, color: Colors.text },
  notice: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, gap: 8 },
  noticeText: { fontSize: 14, color: Colors.text },
  error: { fontSize: 14, color: Colors.live },
  hint: { fontSize: 13, color: Colors.textSecondary },
  mapWrap: { height: 240, borderRadius: 14, overflow: "hidden" },
  map: { flex: 1 },
  address: { fontSize: 14, color: Colors.text, fontWeight: "600" },
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
