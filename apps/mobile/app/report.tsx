import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { IncidentType } from "@servisneinfo/shared";
import { Colors } from "../constants/colors";
import { TYPE_ICON } from "../constants/incident";
import { isTooManyRequests, streetAt, submitReport } from "../services/api";
import { useAddresses, useDevice } from "../hooks/useDevice";
import { useLocation } from "../hooks/useLocation";
import { AddressSearch, Pin, PinMap } from "../components/AddressSearch";

const TYPES: { type: IncidentType; label: string }[] = [
  { type: "water",       label: "Voda" },
  { type: "electricity", label: "Struja" },
  { type: "gas",         label: "Gas" },
  { type: "heating",     label: "Grijanje" },
  { type: "internet",    label: "Internet" },
];

// Isti minimumi kao web forma i backend (POST /reports)
const MIN_TITLE = 5;

export default function ReportScreen() {
  const { tokenId } = useDevice();
  const { data: addresses = [] } = useAddresses();
  const { location } = useLocation();
  const queryClient = useQueryClient();

  const [type, setType] = useState<IncidentType | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // Trenutna lokacija samo kad je opcija lokacije uključena (KTD11): useLocation je tada jedini izvor
  const pickCurrentLocation = async () => {
    if (!location) return;
    setPin({ ...location, address: "Moja trenutna lokacija" });
    const street = await streetAt(location.lat, location.lng);
    if (street) setPin((p) => (p && p.lat === location.lat && p.lng === location.lng ? { ...p, address: street } : p));
  };

  const send = async () => {
    if (!type) return setError("Odaberite vrstu kvara.");
    if (!pin) return setError("Označite mjesto kvara na mapi.");
    if (title.trim().length < MIN_TITLE) return setError(`Kratak opis mora imati najmanje ${MIN_TITLE} znakova.`);
    if (!tokenId) return setError("Aplikacija još nije povezana sa serverom. Pokušajte za koji trenutak.");
    setError(null);
    setSending(true);
    try {
      await submitReport(
        {
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          address: pin.address.trim().length >= 3 ? pin.address.trim() : "Označeno na mapi",
          lat: pin.lat,
          lng: pin.lng,
          reporterName: reporterName.trim() || undefined,
          contact: contact.trim() || undefined,
        },
        tokenId
      );
      // Prijava se odmah vidi kao nepotvrđena u listi i na mapi
      queryClient.invalidateQueries({ queryKey: ["incidents", "reports"] });
      setSent(true);
    } catch (err) {
      setError(
        isTooManyRequests(err)
          ? "Previše prijava sa ove mreže. Pokušajte kasnije."
          : "Slanje nije uspjelo. Provjerite internet vezu i pokušajte ponovo."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.header}>
        <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Nazad">
          <Text style={styles.back}>‹ Nazad</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>PRIJAVI KVAR</Text>
      </View>

      {sent ? (
        // Ista potvrda za svaku prijavu (KTD9)
        <View style={styles.done}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Hvala na prijavi!</Text>
          <Text style={styles.doneText}>
            Prijava je vidljiva kao nepotvrđena. Kad je potvrde drugi građani ili moderator, postaje prekid i
            obavijest stiže svima u blizini.
          </Text>
          <TouchableOpacity style={styles.button} onPress={close} accessibilityRole="button">
            <Text style={styles.buttonText}>Gotovo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>ŠTA NE RADI?</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.type}
                style={[styles.chip, type === t.type && styles.chipActive]}
                onPress={() => setType(t.type)}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t.type }}
              >
                <Text style={[styles.chipText, type === t.type && styles.chipTextActive]}>
                  {TYPE_ICON[t.type]} {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>GDJE?</Text>
          {pin && !searching ? (
            <>
              <PinMap pin={pin} onMove={setPin} />
              <TouchableOpacity onPress={() => setPin(null)} accessibilityRole="button">
                <Text style={styles.link}>Promijeni mjesto</Text>
              </TouchableOpacity>
            </>
          ) : searching ? (
            <>
              <AddressSearch onSelect={(p) => { setPin(p); setSearching(false); }} />
              <TouchableOpacity onPress={() => setSearching(false)} accessibilityRole="button">
                <Text style={styles.link}>Odustani od pretrage</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.chips}>
              {addresses.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.chip}
                  onPress={() => setPin({ lat: a.lat, lng: a.lng, address: a.address })}
                  accessibilityRole="button"
                >
                  <Text style={styles.chipText}>🏠 {a.label}</Text>
                </TouchableOpacity>
              ))}
              {location && (
                <TouchableOpacity style={styles.chip} onPress={pickCurrentLocation} accessibilityRole="button">
                  <Text style={styles.chipText}>📍 Moja lokacija</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.chip} onPress={() => setSearching(true)} accessibilityRole="button">
                <Text style={styles.chipText}>🔎 Traži adresu</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.fieldLabel}>KRATAK OPIS</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="npr. Nema vode od jutros"
            maxLength={200}
            accessibilityLabel="Kratak opis"
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalji (opciono)"
            multiline
            maxLength={1000}
            accessibilityLabel="Detalji"
          />

          <Text style={styles.fieldLabel}>KONTAKT (OPCIONO)</Text>
          <TextInput style={styles.input} value={reporterName} onChangeText={setReporterName} placeholder="Ime" maxLength={100} accessibilityLabel="Ime" />
          <TextInput
            style={styles.input}
            value={contact}
            onChangeText={setContact}
            placeholder="Telefon ili email"
            maxLength={100}
            autoCapitalize="none"
            accessibilityLabel="Kontakt"
          />
          <Text style={styles.hint}>Vidi ih samo moderator. Brišu se 7 dana nakon obrade prijave.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, sending && styles.buttonDisabled]}
            onPress={send}
            disabled={sending}
            accessibilityRole="button"
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pošalji prijavu</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
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
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  fieldLabel: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 1, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.divider },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
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
  multiline: { minHeight: 90, textAlignVertical: "top" },
  hint: { fontSize: 12, color: Colors.textSecondary },
  link: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  error: { fontSize: 14, color: Colors.live },
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  done: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  doneText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
