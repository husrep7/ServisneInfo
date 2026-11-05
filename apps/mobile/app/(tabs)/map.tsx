import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocation } from "../../hooks/useLocation";
import { useIncidents, usePublicReports } from "../../hooks/useIncidents";
import { useAddresses } from "../../hooks/useDevice";
import { ReportSheet } from "../../components/ReportCard";
import { Colors } from "../../constants/colors";
import { Incident, PublicReport } from "../../services/api";
import { distanceMeters, incidentPath, polygonParts, REPORT_NEAR_METERS } from "../../constants/incident";
import { router } from "expo-router";

const SARAJEVO_REGION = {
  latitude: 43.8563,
  longitude: 18.4131,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LEGEND: { type: Incident["type"]; label: string }[] = [
  { type: "water",       label: "Voda" },
  { type: "electricity", label: "Struja" },
  { type: "gas",         label: "Gas" },
  { type: "heating",     label: "Grijanje" },
  { type: "internet",    label: "Internet" },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { location, enabled: locationEnabled } = useLocation();
  const [nearMe, setNearMe] = useState(false);
  const [openReport, setOpenReport] = useState<PublicReport | null>(null);
  const { data: incidents = [], isLoading } = useIncidents(location?.lat, location?.lng, { mine: nearMe });
  const { data: allReports = [] } = usePublicReports();
  const { data: addresses = [] } = useAddresses();

  const withPolygon = incidents.filter((i) => i.area_geojson !== null);
  // Nepotvrđene prijave su tačke, ne zone (KTD12); "Kod mene" = do 500 m od sačuvane adrese
  const reports = useMemo(
    () =>
      allReports.filter((r) =>
        r.lat !== null && r.lng !== null &&
        (!nearMe || addresses.some((a) => distanceMeters(a, { lat: r.lat!, lng: r.lng! }) <= REPORT_NEAR_METERS))),
    [allReports, addresses, nearMe]
  );

  const centerOnUser = () => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    }, 400);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      {/* Signal-style map header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>KARTA INCIDENATA</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>
            {withPolygon.length} prikazano
          </Text>
          <TouchableOpacity
            style={[styles.nearChip, nearMe && styles.nearChipActive]}
            onPress={() => setNearMe((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: nearMe }}
            accessibilityLabel="Kod mene: samo prekidi na mojim adresama"
          >
            <Text style={styles.nearChipText}>📍 Kod mene</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={
          location
            ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
            : SARAJEVO_REGION
        }
        // showsUserLocation sam traži dozvolu za lokaciju, pa samo uz uključenu opciju (KTD11)
        showsUserLocation={locationEnabled}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {withPolygon.map((incident) => {
          const color = Colors.incident[incident.type];
          return polygonParts(incident.area_geojson!).map((coords, n) => (
            <Polygon
              key={`${incident.id}:${n}`}
              coordinates={coords}
              fillColor={`${color}30`}
              strokeColor={color}
              strokeWidth={2}
              tappable
              onPress={() => router.push(incidentPath(incident.id))}
            />
          ));
        })}
        {reports.map((r) => (
          <Marker
            key={`r:${r.id}`}
            coordinate={{ latitude: r.lat!, longitude: r.lng! }}
            pinColor={Colors.incident[r.type]}
            opacity={0.7}
            title="Nepotvrđena prijava"
            onPress={() => setOpenReport(r)}
          />
        ))}
      </MapView>

      {nearMe && addresses.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Dodajte adresu u Postavkama da vidite prekide kod sebe.</Text>
        </View>
      )}

      <ReportSheet report={openReport} onClose={() => setOpenReport(null)} />

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.loaderText}>Učitavam...</Text>
        </View>
      )}

      {/* Dugme za moju lokaciju: samo kad je lokacija uključena i poznata */}
      {location && (
        <TouchableOpacity
          style={styles.myLocationBtn}
          onPress={centerOnUser}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Centriraj mapu na moju lokaciju"
        >
          <Text style={styles.myLocationIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Legend card */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>LEGENDA</Text>
        {LEGEND.map(({ type, label }) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.incident[type] }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navy },

  header: {
    backgroundColor: Colors.navy,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  headerCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  map: { flex: 1 },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  nearChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nearChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  nearChipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  notice: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 84,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  noticeText: { fontSize: 13, color: Colors.text },

  loader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 120 : 80,
    alignSelf: "center",
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  loaderText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  myLocationBtn: {
    position: "absolute",
    bottom: 100,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: 30,
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  myLocationIcon: { fontSize: 22 },

  legend: {
    position: "absolute",
    top: Platform.OS === "ios" ? 118 : 78,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    padding: 12,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.text, fontWeight: "500" },
});
