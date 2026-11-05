import React, { useState } from "react";
import { Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import type { IncidentType } from "@servisneinfo/shared";
import { Colors } from "../constants/colors";
import { TYPE_ICON } from "../constants/incident";
import { ReminderMinutes } from "../services/api";
import { useDevice, useDeviceSettings } from "../hooks/useDevice";
import { requestLocationPermission } from "../hooks/useLocation";

const TYPES: { type: IncidentType; label: string }[] = [
  { type: "water",       label: "Voda" },
  { type: "electricity", label: "Struja" },
  { type: "gas",         label: "Gas" },
  { type: "heating",     label: "Grijanje" },
  { type: "internet",    label: "Internet" },
];

const REMINDERS: { value: ReminderMinutes; label: string }[] = [
  { value: null, label: "Isključen" },
  { value: 30,   label: "30 min" },
  { value: 60,   label: "1 h" },
  { value: 180,  label: "3 h" },
  { value: 720,  label: "12 h" },
];

// Stalna traka kad push nije dozvoljen
export function PushBanner() {
  const { pushStatus, enablePush } = useDevice();
  if (pushStatus === null || pushStatus === "granted") return null;
  if (pushStatus === "unavailable") {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Obavijesti nisu dostupne</Text>
        <Text style={styles.bannerText}>Push obavijesti rade samo na pravom telefonu.</Text>
      </View>
    );
  }
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>Obavijesti su isključene</Text>
      <Text style={styles.bannerText}>Nećete dobiti upozorenje o prekidu na vašim adresama.</Text>
      <TouchableOpacity
        onPress={() => (pushStatus === "undetermined" ? enablePush() : Linking.openSettings())}
        accessibilityRole="button"
      >
        <Text style={styles.link}>
          {pushStatus === "undetermined" ? "Uključi obavijesti" : "Otvori podešavanja telefona"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Lokacija je opt-in: dozvola se traži tek kad korisnik uključi prekidač (KTD11)
export function LocationToggle() {
  const { data: settings, update } = useDeviceSettings();
  const [denied, setDenied] = useState(false);
  const enabled = settings?.locationEnabled ?? false;

  const onChange = async (value: boolean) => {
    setDenied(false);
    if (value && !(await requestLocationPermission())) {
      setDenied(true);
      return;
    }
    await update({ locationEnabled: value }).catch(() => null);
  };

  return (
    <View>
      <Row
        title="Obavijesti po mojoj lokaciji"
        subtitle="Upozorenje i kad ste van sačuvanih adresa. Lokacija se šalje samo dok je ovo uključeno."
      >
        <Switch value={enabled} onValueChange={onChange} disabled={!settings} accessibilityLabel="Obavijesti po mojoj lokaciji" />
      </Row>
      {denied && (
        <View style={styles.inlineNotice}>
          <Text style={styles.bannerText}>Bez dozvole za lokaciju ova opcija ne može raditi.</Text>
          <TouchableOpacity onPress={() => Linking.openSettings()} accessibilityRole="button">
            <Text style={styles.link}>Otvori podešavanja telefona</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function ReminderPicker() {
  const { data: settings, update } = useDeviceSettings();
  return (
    <View style={styles.block}>
      <Text style={styles.rowTitle}>Podsjetnik prije planiranog prekida</Text>
      <View style={styles.chips}>
        {REMINDERS.map((r) => {
          const selected = settings?.reminderMinutes === r.value;
          return (
            <TouchableOpacity
              key={String(r.value)}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => update({ reminderMinutes: r.value }).catch(() => null)}
              disabled={!settings}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Prekidi isključene usluge i dalje se vide u listi; samo push ne stiže (R13)
export function TypeToggles() {
  const { data: settings, update } = useDeviceSettings();
  const muted = settings?.mutedTypes ?? [];

  const toggle = (type: IncidentType, on: boolean) => {
    const next = on ? muted.filter((t) => t !== type) : [...muted, type];
    update({ mutedTypes: next }).catch(() => null);
  };

  return (
    <View>
      {TYPES.map(({ type, label }) => (
        <Row key={type} title={`${TYPE_ICON[type]}  ${label}`}>
          <Switch
            value={!muted.includes(type)}
            onValueChange={(on) => toggle(type, on)}
            disabled={!settings}
            accessibilityLabel={`Obavijesti za uslugu ${label}`}
          />
        </Row>
      ))}
    </View>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#FDECEC", borderRadius: 12, padding: 14, gap: 4 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  bannerText: { fontSize: 13, color: Colors.textSecondary },
  inlineNotice: { paddingHorizontal: 2, paddingBottom: 8, gap: 4 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: "600", marginTop: 4 },
  block: { gap: 10, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: Colors.text, fontWeight: "500" },
  rowSubtitle: { fontSize: 12, color: Colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.divider },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
});
