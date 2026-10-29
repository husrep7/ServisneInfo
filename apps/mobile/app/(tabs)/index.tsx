import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useLocation } from "../../hooks/useLocation";
import { useIncidents } from "../../hooks/useIncidents";
import { IncidentCard } from "../../components/IncidentCard";
import { Incident } from "../../services/api";
import { Colors } from "../../constants/colors";

type Filter = Incident["type"] | "all";

const FILTERS: { label: string; value: Filter; icon: string }[] = [
  { label: "Sve",      value: "all",         icon: "📋" },
  { label: "Voda",     value: "water",       icon: "💧" },
  { label: "Struja",   value: "electricity", icon: "⚡" },
  { label: "Gas",      value: "gas",         icon: "🔥" },
  { label: "Grijanje", value: "heating",     icon: "🏠" },
  { label: "Internet", value: "internet",    icon: "🌐" },
];

export default function HomeScreen() {
  const { location, error: locationError } = useLocation();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const { data: incidents = [], isLoading, isFetching, refetch } = useIncidents(
    location?.lat,
    location?.lng
  );

  const activeCount = incidents.filter((i) => i.status === "active").length;

  const filtered =
    activeFilter === "all"
      ? incidents
      : incidents.filter((i) => i.type === activeFilter);

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
      <View style={styles.filterRow}>
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
      </View>

      {/* Section heading */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {activeFilter === "all" ? "Svi incidenti" : FILTERS.find((f) => f.value === activeFilter)?.label}
        </Text>
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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <IncidentCard incident={item} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          ListEmptyComponent={<EmptyState hasLocation={!!location} />}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
          : "Omogućite lokaciju za personalizirane obavijesti."}
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: "nowrap",
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
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
