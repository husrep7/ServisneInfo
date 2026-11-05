import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { router, useLocalSearchParams } from "expo-router";
import { useIncident } from "../../hooks/useIncidents";
import { Colors } from "../../constants/colors";
import {
  formatDateTime,
  polygonParts,
  STATUS_LABEL,
  TYPE_ICON,
  TYPE_LABEL,
} from "../../constants/incident";

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: incident, isLoading, isError, refetch } = useIncident(id);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Nazad"
        >
          <Text style={styles.back}>‹ Nazad</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>PREKID</Text>
      </View>

      {isLoading ? (
        <Centered>
          <ActivityIndicator size="large" color={Colors.primary} />
        </Centered>
      ) : isError ? (
        <Centered>
          <Text style={styles.emptyTitle}>Učitavanje nije uspjelo</Text>
          <Text style={styles.emptyText}>Provjerite internet vezu i pokušajte ponovo.</Text>
          <TouchableOpacity style={styles.button} onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.buttonText}>Pokušaj ponovo</Text>
          </TouchableOpacity>
        </Centered>
      ) : !incident ? (
        <Centered>
          <Text style={styles.emptyTitle}>Prekid nije pronađen</Text>
          <Text style={styles.emptyText}>Obavijest je možda uklonjena ili link nije ispravan.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace("/")} accessibilityRole="button">
            <Text style={styles.buttonText}>Idi na početnu</Text>
          </TouchableOpacity>
        </Centered>
      ) : (
        <IncidentDetail incident={incident} />
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

type Incident = NonNullable<ReturnType<typeof useIncident>["data"]>;

function IncidentDetail({ incident }: { incident: Incident }) {
  const mapRef = useRef<MapView>(null);
  const color = Colors.incident[incident.type];
  const parts = useMemo(
    () => (incident.area_geojson ? polygonParts(incident.area_geojson) : []),
    [incident.area_geojson]
  );
  const statusColor = Colors.status[incident.status];
  const addresses = incident.affected_addresses ?? [];

  const fitZone = () => {
    const coords = parts.flat();
    if (coords.length === 0) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
      animated: false,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.metaRow}>
        <Text style={[styles.category, { color }]}>
          {TYPE_ICON[incident.type]} {TYPE_LABEL[incident.type]}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{STATUS_LABEL[incident.status]}</Text>
        </View>
      </View>

      <Text style={styles.title}>{incident.title}</Text>

      {incident.origin === "user" && (
        <View style={styles.userNote}>
          <Text style={styles.userNoteTitle}>Prijava korisnika</Text>
          <Text style={styles.userNoteText}>
            Potvrđeno na osnovu prijava građana, nije službena obavijest preduzeća.
          </Text>
        </View>
      )}

      {(incident.starts_at || incident.ends_at) && (
        <View style={styles.card}>
          {incident.starts_at && (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Početak</Text>
              <Text style={styles.timeValue}>{formatDateTime(incident.starts_at)}</Text>
            </View>
          )}
          {incident.ends_at && (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Kraj</Text>
              <Text style={styles.timeValue}>{formatDateTime(incident.ends_at)}</Text>
            </View>
          )}
        </View>
      )}

      {parts.length > 0 ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            onMapReady={fitZone}
            initialRegion={{
              latitude: parts[0][0].latitude,
              longitude: parts[0][0].longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            accessibilityLabel="Zona prekida na mapi"
          >
            {parts.map((coords, n) => (
              <Polygon
                key={n}
                coordinates={coords}
                fillColor={`${color}30`}
                strokeColor={color}
                strokeWidth={2}
              />
            ))}
          </MapView>
        </View>
      ) : (
        <Text style={styles.muted}>Zona za ovaj prekid još nije određena.</Text>
      )}

      {addresses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Zahvaćene ulice · {addresses.length}</Text>
          {addresses.map((a) => (
            <Text key={a} style={styles.address}>📍 {a}</Text>
          ))}
        </View>
      )}

      {incident.description && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Obavijest</Text>
          <Text style={styles.description}>{incident.description}</Text>
        </View>
      )}

      {incident.source_url && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(incident.source_url!)}
          accessibilityRole="link"
          accessibilityLabel="Otvori zvanični izvor"
        >
          <Text style={styles.buttonText}>Otvori zvanični izvor →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },

  content: { padding: 16, gap: 12, paddingBottom: 40 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  category: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text, lineHeight: 24 },

  userNote: { backgroundColor: "#FFF4D6", borderRadius: 12, padding: 12, gap: 2 },
  userNoteTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  userNoteText: { fontSize: 12, color: Colors.textSecondary },

  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, gap: 6 },
  cardTitle: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, letterSpacing: 1, marginBottom: 2 },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeLabel: { fontSize: 13, color: Colors.textSecondary },
  timeValue: { fontSize: 13, fontWeight: "600", color: Colors.text },
  address: { fontSize: 14, color: Colors.text },
  description: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: Colors.textSecondary },

  mapWrap: { height: 240, borderRadius: 14, overflow: "hidden" },
  map: { flex: 1 },

  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
