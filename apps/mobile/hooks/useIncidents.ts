import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { fetchIncident, fetchIncidents, fetchPublicReports, Incident, PublicReport, WS_URL } from "../services/api";
import { useDevice } from "./useDevice";

// Ključ počinje sa "incidents", pa ga WebSocket događaji osvježe kao i listu
export function useIncident(id: string | undefined) {
  return useQuery<Incident | null>({
    queryKey: ["incidents", "detail", id],
    queryFn: () => fetchIncident(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// mine=true: "Kod mene" (R4); čeka registraciju uređaja jer server traži tokenId
export function useIncidents(lat?: number, lng?: number, opts: { mine?: boolean } = {}) {
  const { tokenId } = useDevice();
  const mine = !!opts.mine;
  return useQuery<Incident[]>({
    queryKey: ["incidents", lat, lng, mine ? tokenId : "all"],
    queryFn: () => fetchIncidents({ lat, lng, mine }),
    enabled: !mine || !!tokenId,
    refetchInterval: 60_000, // Fallback polling every 60s
    staleTime: 30_000,
  });
}

// Nepotvrđene prijave nemaju WebSocket događaj, pa se osvježavaju svake minute
export function usePublicReports() {
  return useQuery<PublicReport[]>({
    queryKey: ["incidents", "reports"],
    queryFn: fetchPublicReports,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// Jedan WebSocket za cijelu aplikaciju (montira se u root layoutu).
// Automatski se ponovo spaja (exponential backoff) i kad se app vrati u foreground.
export function useIncidentUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["incidents"] });

    const open = () => {
      clearTimeout(timer);
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        if (retry > 0) invalidate(); // mogli smo propustiti evente dok veza nije radila
        retry = 0;
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string };
          if (msg.type === "incident:new" || msg.type === "incident:resolved") invalidate();
        } catch {
          // ignoriši neispravne poruke
        }
      };
      ws.onerror = () => {/* onclose će zakazati reconnect; HTTP polling je fallback */};
      ws.onclose = () => {
        if (closed) return;
        timer = setTimeout(open, Math.min(30_000, 1000 * 2 ** retry++));
      };
    };
    open();

    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active" && ws?.readyState !== WebSocket.OPEN) {
        retry = 0;
        ws?.close();
        open();
      }
    });

    return () => {
      closed = true;
      clearTimeout(timer);
      appState.remove();
      ws?.close();
    };
  }, [queryClient]);
}
