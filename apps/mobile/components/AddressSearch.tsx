import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Colors } from "../constants/colors";
import { AddressMatch, isTooManyRequests, searchAddress } from "../services/api";

export const SARAJEVO = { lat: 43.8563, lng: 18.4131 };

export interface Pin {
  lat: number;
  lng: number;
  address: string;
}

type Search =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "results"; matches: AddressMatch[] }
  | { state: "none" }
  | { state: "error"; message: string };

// Pretraga adrese u Kantonu Sarajevo (KTD12). Bez rezultata nudi ručni pin;
// kod greške ili 429 upisani tekst ostaje i nudi se ponovni pokušaj.
export function AddressSearch({ onSelect, placeholder }: { onSelect: (pin: Pin) => void; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });

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

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder={placeholder ?? "Ulica i broj, npr. Ferhadija 12"}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Adresa"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} accessibilityRole="button" accessibilityLabel="Traži adresu">
          <Text style={styles.searchBtnText}>Traži</Text>
        </TouchableOpacity>
      </View>

      {search.state === "loading" && <ActivityIndicator color={Colors.primary} style={styles.loading} />}

      {search.state === "results" && search.matches.map((m) => (
        <TouchableOpacity
          key={`${m.lat},${m.lng}`}
          style={styles.result}
          onPress={() => onSelect({ lat: m.lat, lng: m.lng, address: m.label })}
          accessibilityRole="button"
        >
          <Text style={styles.resultText}>📍 {m.label}</Text>
        </TouchableOpacity>
      ))}

      {search.state === "none" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Adresa nije pronađena u Kantonu Sarajevo.</Text>
          <TouchableOpacity onPress={() => onSelect({ ...SARAJEVO, address: query.trim() })} accessibilityRole="button">
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
    </View>
  );
}

// Mapa sa pinom koji se povuče ili postavi dodirom; korisnik potvrđuje tačku (KTD12)
export function PinMap({ pin, onMove }: { pin: Pin; onMove: (pin: Pin) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Povucite pin ili dodirnite mapu da označite tačno mjesto.</Text>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{ latitude: pin.lat, longitude: pin.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
          onPress={(e) => onMove({ ...pin, lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
        >
          <Marker
            draggable
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            onDragEnd={(e) => onMove({ ...pin, lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          />
        </MapView>
      </View>
      <Text style={styles.address} numberOfLines={2}>{pin.address}</Text>
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
  searchBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loading: { marginVertical: 12 },
  result: { backgroundColor: Colors.card, borderRadius: 12, padding: 14 },
  resultText: { fontSize: 14, color: Colors.text },
  notice: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, gap: 8 },
  noticeText: { fontSize: 14, color: Colors.text },
  error: { fontSize: 14, color: Colors.live },
  link: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 13, color: Colors.textSecondary },
  mapWrap: { height: 240, borderRadius: 14, overflow: "hidden" },
  map: { flex: 1 },
  address: { fontSize: 14, color: Colors.text, fontWeight: "600" },
});
