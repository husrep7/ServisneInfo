import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useLocation } from "../../hooks/useLocation";
import { useIncidents, usePublicReports } from "../../hooks/useIncidents";
import { useAddresses } from "../../hooks/useDevice";
import { IncidentCard } from "../../components/IncidentCard";
import { ReportCard, ReportSheet } from "../../components/ReportCard";
import { Incident, PublicReport } from "../../services/api";
import { Colors } from "../../constants/colors";
import { distanceMeters, REPORT_NEAR_METERS } from "../../constants/incident";

type Filter = Incident["type"] | "all";

const FILTERS: { label: string; value: Filter; icon: string }[] = [
  { label: "Sve",      value: "all",         icon: "📋" },
  { label: "Voda",     value: "water",       icon: "💧" },
  { label: "Struja",   value: "electricity", icon: "⚡" },
  { label: "Gas",      value: "gas",         icon: "🔥" },
  { label: "Grijanje", value: "heating",     icon: "🏠" },
  { label: "Internet", value: "internet",    icon: "🌐" },
];

type Row =
  | { kind: "incident"; key: string; incident: Incident }
  | { kind: "report"; key: string; report: PublicReport };

export default function HomeScreen() {
  const { location, error: locationError } = useLocation();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [nearMe, setNearMe] = useState(false);
  const [openReport, setOpenReport] = useState<PublicReport | null>(null);

  const { data: addresses = [] } = useAddresses();
  const { data: incidents = [], isLoading, isFetching, refetch } = useIncidents(
    location?.lat,
    location?.lng,
    { mine: nearMe }
  );
  const { data: allReports = [], refetch: refetchReports } = usePublicReports();

  // "Kod mene" za prijave: u krugu od 500 m oko neke sačuvane adrese
  const reports = useMemo(
    () =>
      nearMe
        ? allReports.filter((r) =>
            r.lat !== null && r.lng !== null &&
            addresses.some((a) => distanceMeters(a, { lat: r.lat!, lng: r.lng! }) <= REPORT_NEAR_METERS))
        : allReports,
    [nearMe, allReports, addresses]
  );

  const activeCount = incidents.filter((i) => i.status === "active").length;
  const matchesType = (type: Incident["type"]) => activeFilter === "all" || type === activeFilter;

  // Filter po tipu važi i za prijave (R3); prijave idu iza prekida
  const rows: Row[] = [
    ...incidents.filter((i) => matchesType(i.type)).map((i) => ({ kind: "incident" as const, key: i.id, incident: i })),
    ...reports.filter((r) => matchesType(r.type)).map((r) => ({ kind: "report" as const, key: `r:${r.id}`, report: r })),
  ];

  const refresh = () => {
    refetch();
    refetchReports();
  };

  const sectionTitle = [
    nearMe ? "Kod mene" : null,
    activeFilter === "all" ? (nearMe ? null : "Svi incidenti") : FILTERS.find((f) => f.value === activeFilter)?.label,
  ].filter(Boolean).join(" · ");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.navy} />

      {/* Signal-style header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>KOMUNALNI INFO</Text>
          <Text style={styles.headerTitle}>Sarajevo</Text>
        </View>
        <View style={styles.headerRight}>
          {activeCount > 0 && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{activeCount} aktivno</Text>
            </View>
          )}
          {location && (
            <View style={styles.locationDot}>
              <View style={styles.locationDotInner} />
            </View>
          )}
        </View>
      </View>

      {/* Location permission warning */}
      {locationError && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>⚠️  {locationError}</Text>
        </View>
      )}

      {/* Filter chips — Signal pill style */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.chip, nearMe && styles.chipNear]}
          onPress={() => setNearMe((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: nearMe }}
          accessibilityLabel="Kod mene: samo prekidi na mojim adresama"
        >
          <Text style={[styles.chipText, nearMe && styles.chipTextActive]}>📍 Kod mene</Text>
        </TouchableOpacity>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.value;
          const count =
            f.value === "all"
              ? incidents.length
              : incidents.filter((i) => i.type === f.value).length;

          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveFilter(f.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {f.icon} {f.label}
                {count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section heading */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={Colors.primary} />
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Učitavam podatke...</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) =>
            item.kind === "incident"
              ? <IncidentCard incident={item.incident} />
              : <ReportCard report={item.report} onPress={() => setOpenReport(item.report)} />
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          ListEmptyComponent={
            nearMe
              ? <NearMeEmpty hasAddresses={addresses.length > 0} />
              : <EmptyState hasLocation={!!location} />
          }
          contentContainerStyle={
            rows.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <ReportSheet report={openReport} onClose={() => setOpenReport(null)} />
    </View>
  );
}

function NearMeEmpty({ hasAddresses }: { hasAddresses: boolean }) {
  if (!hasAddresses) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>Dodajte adresu da vidite prekide kod sebe</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/settings")} accessibilityRole="button">
          <Text style={styles.emptyButtonText}>Otvori Postavke</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>✅</Text>
      <Text style={styles.emptyTitle}>Trenutno nema prekida na vašim adresama</Text>
    </View>
  );
}

function EmptyState({ hasLocation }: { hasLocation: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>✅</Text>
      <Text style={styles.emptyTitle}>Sve je u redu</Text>
      <Text style={styles.emptySubtitle}>
        {hasLocation
          ? "Nema aktivnih komunalnih poremećaja u ovom trenutku."
          : "Nema aktivnih komunalnih poremećaja. Uključite lokaciju u Postavkama za udaljenost do prekida."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header — Signal dark navy
  header: {
    backgroundColor: Colors.navy,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeBadge: {
    backgroundColor: Colors.live,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(150, 190, 79, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },

  // Warning bar
  warningBar: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE0B2",
  },
  warningText: { color: "#E65100", fontSize: 12 },

  // Filters
  filterBar: {
    flexGrow: 0,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  chipNear: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  chipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },

  // Section heading
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  // Empty
  emptyContainer: { flexGrow: 1 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  emptyButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
