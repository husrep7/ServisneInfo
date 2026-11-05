import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../constants/colors";
import { TYPE_ICON, TYPE_LABEL, timeAgo } from "../constants/incident";
import { PublicReport, REPORT_PENDING_HOURS } from "../services/api";

// Nepotvrđena prijava u listi (R15): jasno označena, ne vodi na detalje prekida
export function ReportCard({ report, onPress }: { report: PublicReport; onPress: () => void }) {
  const color = Colors.incident[report.type];
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Nepotvrđena prijava: ${report.title}`}
    >
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color }]}>
            {TYPE_ICON[report.type]} {TYPE_LABEL[report.type]}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NEPOTVRĐENO</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>{report.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          📍 {report.address} · prijavljeno {timeAgo(report.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function expiresIn(createdAt: string, now = Date.now()): string {
  const left = new Date(createdAt).getTime() + REPORT_PENDING_HOURS * 3_600_000 - now;
  if (left <= 0) return "uskoro";
  const h = Math.floor(left / 3_600_000);
  const min = Math.round((left % 3_600_000) / 60_000);
  return h > 0 ? `za ${h} h ${min} min` : `za ${min} min`;
}

// Donji panel sa detaljima nepotvrđene prijave
export function ReportSheet({ report, onClose }: { report: PublicReport | null; onClose: () => void }) {
  return (
    <Modal visible={!!report} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zatvori" />
      {report && (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.metaRow}>
            <Text style={[styles.category, { color: Colors.incident[report.type] }]}>
              {TYPE_ICON[report.type]} {TYPE_LABEL[report.type]}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NEPOTVRĐENO</Text>
            </View>
          </View>
          <Text style={styles.sheetTitle}>{report.title}</Text>
          {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
          <Text style={styles.meta}>📍 {report.address}</Text>
          <Text style={styles.meta}>Prijavljeno {timeAgo(report.created_at)}</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Nepotvrđeno – čeka potvrdu, ističe {expiresIn(report.created_at)}. Prijava postaje prekid kad je
              potvrde drugi građani ili moderator.
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>Zatvori</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
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
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.divider,
  },
  accentBar: { width: 4, opacity: 0.5 },
  content: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  category: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  badge: { backgroundColor: Colors.textSecondary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.text, lineHeight: 19 },
  meta: { fontSize: 12, color: Colors.textSecondary },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.divider, marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  description: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  notice: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, marginTop: 4 },
  noticeText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  button: { backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
