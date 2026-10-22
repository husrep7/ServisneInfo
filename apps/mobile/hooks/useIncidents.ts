import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchIncidents, Incident } from "../services/api";
import Constants from "expo-constants";

const WS_URL =
  (Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000")
    .replace("http", "ws") + "/ws";

export function useIncidents(lat?: number, lng?: number) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  const query = useQuery<Incident[]>({
    queryKey: ["incidents", lat, lng],
    queryFn: () => fetchIncidents({ lat, lng }),
    refetchInterval: 60_000, // Fallback polling every 60s
    staleTime: 30_000,
  });

  // WebSocket for instant updates when app is in foreground
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string };
      if (msg.type === "incident:new" || msg.type === "incident:resolved") {
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
      }
    };

    ws.onerror = () => {/* silent — HTTP polling is the fallback */};

    return () => ws.close();
  }, [queryClient]);

  return query;
}
