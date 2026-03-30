import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { AnimatedButton } from "../components/AnimatedButton";
import { nakamaService } from "../services/nakama";
import { commonStyles } from "../theme/commonStyles";
import { colors } from "../theme/colors";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function rankLabel(index: number): string {
  return MEDALS[index] ?? `${index + 1}`;
}

function cellNum(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

export const LeaderboardScreen: React.FC = () => {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await nakamaService.fetchLeaderboard();
      setRows(data as Array<Record<string, unknown>>);
    } finally {
      setLoading(false);
    }
  }, []);

  const emptyHint = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>No data yet</Text>
        <Text style={styles.emptySub}>Tap refresh to load the leaderboard</Text>
      </View>
    ),
    []
  );

  return (
    <View style={[commonStyles.screen, styles.screen]}>
      <Text style={commonStyles.title}>Leaderboard</Text>
      <AnimatedButton title={loading ? "Loading…" : "Refresh"} onPress={load} disabled={loading} />

      {rows.length === 0 && !loading ? (
        emptyHint
      ) : (
        <View style={styles.tableWrap}>
          <View style={[styles.tr, styles.trHeader]}>
            <Text style={[styles.th, styles.colRank]}>🏅</Text>
            <Text style={[styles.th, styles.colName]} numberOfLines={1}>
              👤 Player
            </Text>
            <Text style={[styles.th, styles.colStat]}>✓</Text>
            <Text style={[styles.th, styles.colStat]}>✗</Text>
            <Text style={[styles.th, styles.colStat]}>🤝</Text>
            <Text style={[styles.th, styles.colElo]}>⭐</Text>
          </View>
          <View style={styles.headerSubRow}>
            <Text style={[styles.thSub, styles.colRank]} />
            <Text style={[styles.thSub, styles.colName]} />
            <Text style={[styles.thSub, styles.colStat]}>W</Text>
            <Text style={[styles.thSub, styles.colStat]}>L</Text>
            <Text style={[styles.thSub, styles.colStat]}>D</Text>
            <Text style={[styles.thSub, styles.colElo]}>Elo</Text>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(item, idx) => `${item.user_id ?? idx}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={[styles.tr, index % 2 === 1 && styles.trAlt]}>
                <Text style={[styles.td, styles.colRank, styles.tdRank]}>{rankLabel(index)}</Text>
                <Text style={[styles.td, styles.colName]} numberOfLines={1} ellipsizeMode="tail">
                  {String(item.username ?? "—")}
                </Text>
                <Text style={[styles.td, styles.colStat, styles.tdNum]}>{cellNum(item.wins)}</Text>
                <Text style={[styles.td, styles.colStat, styles.tdNum]}>{cellNum(item.losses)}</Text>
                <Text style={[styles.td, styles.colStat, styles.tdNum]}>{cellNum(item.draws)}</Text>
                <Text style={[styles.td, styles.colElo, styles.tdNum]}>{cellNum(item.elo)}</Text>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  tableWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  trHeader: {
    paddingBottom: 4,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.buttonPrimaryBorder
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  trAlt: {
    backgroundColor: colors.accentSoft
  },
  th: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  thSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  td: {
    color: colors.text,
    fontSize: 14
  },
  tdRank: {
    fontSize: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  tdNum: {
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    fontWeight: "600"
  },
  colRank: { width: 44 },
  colName: { flex: 1, minWidth: 72, paddingHorizontal: 4 },
  colStat: { width: 36 },
  colElo: { width: 44 },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 32
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  emptySub: { color: colors.textMuted, fontSize: 15, textAlign: "center", paddingHorizontal: 24 }
});
