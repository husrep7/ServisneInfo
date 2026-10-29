import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Incident } from "../services/api";
import { Colors } from "../constants/colors";

const TYPE_LABEL: Record<Incident["type"], string> = {
  water:       "VODOVOD",
  electricity: "ELEKTRO",
  gas:         "GAS",
  heating:     "GRIJANJE",
  internet:    "INTERNET",
};

const TYPE_ICON: Record<Incident["type"], string> = {
  water:       "💧",
  electricity: "⚡",
  gas:         "🔥",
  heating:     "🏠",
  internet:    "🌐",
};

function formatDistance(m: number | null): string {
  if (m === null) return "";
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit" });
}

interface Props {
  incident: Incident;
}

export function IncidentCard({ incident }: Props) {
  const accentColor  = Colors.incident[incident.type];
  const bgColor      = Colors.incidentBg[incident.type];
  const isActive     = incident.status === "active";
  const isScheduled  = incident.status === "scheduled";

  return (
    <View style={styles.card}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Icon block */}
      <View style={[styles.iconBlock, { backgroundColor: bgColor }]}>
        <Text style={styles.iconEmoji}>{TYPE_ICON[incident.type]}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Category row */}
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: accentColor }]}>
            {TYPE_LABEL[incident.type]}
          </Text>

          {isActive && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>AKTIVNO</Text>
            </View>
          )}
          {isScheduled && (
            <View style={[styles.liveBadge, { backgroundColor: Colors.gold }]}>
              <Text style={styles.liveText}>PLANIRANO</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {incident.title}
        </Text>

        {/* Addresses */}
        {incident.affected_addresses && incident.affected_addresses.length > 0 && (
          <Text style={styles.addresses} numberOfLines={1}>
            📍{" "}
            {incident.affected_addresses.slice(0, 2).join(", ")}
            {incident.affected_addresses.length > 2
              ? ` +${incident.affected_addresses.length - 2}`
              : ""}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.timeRow}>
            {incident.starts_at && (
              <Text style={styles.timeMeta}>
                {formatDate(incident.starts_at)} · {formatTime(incident.starts_at)}
                {incident.ends_at ? ` – ${formatTime(incident.ends_at)}` : ""}
              </Text>
            )}
          </View>

          <View style={styles.rightMeta}>
            {incident.distance_meters !== null && (
              <Text style={[styles.distance, { color: accentColor }]}>
                {formatDistance(incident.distance_meters)}
              </Text>
            )}
            {incident.source_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(incident.source_url!)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="link"
                accessibilityLabel="Otvori izvornu obavijest"
              >
                <Text style={styles.sourceLink}>Izvor →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: {
    width: 4,
  },
  iconBlock: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 26,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  category: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  liveBadge: {
    backgroundColor: Colors.live,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 5,
  },
  addresses: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeRow: {
    flex: 1,
  },
  timeMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  rightMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  distance: {
    fontSize: 12,
    fontWeight: "700",
  },
  sourceLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },
});
