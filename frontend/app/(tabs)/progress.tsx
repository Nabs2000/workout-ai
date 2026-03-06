import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { api } from '../../services/api';
import { COLORS, GOAL_LABELS, LEVEL_LABELS } from '../../constants';

export default function ProgressScreen() {
  const { userId, profile } = useUserStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['progress', userId],
    queryFn: () => api.progress.getStats(userId!),
    enabled: !!userId,
  });

  const { data: latestAnalysis } = useQuery({
    queryKey: ['analysis', 'latest', userId],
    queryFn: () => api.analyze.getLatest(userId!),
    enabled: !!userId,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Progress</Text>

      {/* Profile summary */}
      <Card style={styles.profileCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>Your Profile</Text>
          <View style={styles.profileGrid}>
            <StatBlock label="Goal" value={GOAL_LABELS[profile?.goal ?? 'build_muscle']} />
            <StatBlock label="Level" value={LEVEL_LABELS[profile?.fitnessLevel ?? 'beginner']} />
            <StatBlock label="Days/Week" value={String(profile?.workoutsPerWeek ?? 3)} />
          </View>
        </Card.Content>
      </Card>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} size="large" />
      ) : !stats ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📈</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>Complete a few workouts to see your stats here.</Text>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Key stats */}
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>All-Time Stats</Text>
              <View style={styles.statsGrid}>
                <BigStatBlock value={String(stats.totalWorkouts)} label="Workouts" emoji="🏋️" />
                <BigStatBlock value={String(stats.totalMinutes)} label="Minutes" emoji="⏱" />
                <BigStatBlock value={`${stats.currentStreak}d`} label="Streak" emoji="🔥" />
                <BigStatBlock
                  value={`${stats.avgDifficulty.toFixed(1)}`}
                  label="Avg Effort"
                  emoji="💪"
                />
              </View>
            </Card.Content>
          </Card>

          {/* Weekly adherence bar chart */}
          {stats.weeklyAdherence.length > 0 && (
            <Card style={styles.chartCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.cardTitle}>Weekly Adherence</Text>
                <Text variant="bodySmall" style={styles.chartSubtitle}>Last 8 weeks</Text>
                <View style={styles.barChart}>
                  {stats.weeklyAdherence.map((pct, i) => (
                    <View key={i} style={styles.barWrapper}>
                      <Text style={styles.barLabel}>{pct}%</Text>
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${pct}%`, backgroundColor: getBarColor(pct) },
                          ]}
                        />
                      </View>
                      <Text style={styles.barWeekLabel}>W{stats.weeklyAdherence.length - i}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Most trained muscle */}
          {stats.mostTrainedMuscle && (
            <Card style={styles.muscleCard}>
              <Card.Content style={styles.muscleContent}>
                <Text style={styles.muscleEmoji}>
                  {stats.mostTrainedMuscle === 'chest' ? '💪'
                    : stats.mostTrainedMuscle === 'legs' ? '🦵'
                    : stats.mostTrainedMuscle === 'cardio' ? '❤️' : '🏋️'}
                </Text>
                <View>
                  <Text style={styles.muscleTitle}>Most Trained</Text>
                  <Text variant="titleLarge" style={styles.muscleName}>
                    {stats.mostTrainedMuscle.charAt(0).toUpperCase() + stats.mostTrainedMuscle.slice(1)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        </>
      )}

      {/* Latest AI analysis */}
      {latestAnalysis && (
        <Card style={styles.analysisCard}>
          <Card.Content>
            <Text style={styles.analysisLabel}>🤖 Latest Nova Analysis</Text>
            <Text style={styles.analysisSummary}>{latestAnalysis.summary}</Text>
            {latestAnalysis.keyInsights.length > 0 && (
              <View style={styles.insightList}>
                {latestAnalysis.keyInsights.map((insight, i) => (
                  <View key={i} style={styles.insightRow}>
                    <Text style={styles.insightDot}>•</Text>
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BigStatBlock({ value, label, emoji }: { value: string; label: string; emoji: string }) {
  return (
    <View style={styles.bigStatBlock}>
      <Text style={styles.bigStatEmoji}>{emoji}</Text>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function getBarColor(pct: number) {
  if (pct >= 80) return COLORS.success;
  if (pct >= 50) return COLORS.warning;
  return COLORS.danger;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 32, gap: 16 },
  title: { color: COLORS.text, fontWeight: 'bold' },
  profileCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  cardTitle: { color: COLORS.text, fontWeight: 'bold', marginBottom: 16 },
  profileGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statBlock: { alignItems: 'center' },
  statValue: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  emptyContent: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontWeight: 'bold', fontSize: 18 },
  emptySubtitle: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  statsCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-around' },
  bigStatBlock: { alignItems: 'center', minWidth: 80 },
  bigStatEmoji: { fontSize: 28, marginBottom: 4 },
  bigStatValue: { color: COLORS.text, fontWeight: 'bold', fontSize: 22 },
  bigStatLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  chartCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  chartSubtitle: { color: COLORS.textMuted, marginBottom: 16 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, justifyContent: 'space-between' },
  barWrapper: { flex: 1, alignItems: 'center', gap: 4 },
  barLabel: { color: COLORS.textMuted, fontSize: 10 },
  barBg: { flex: 1, width: '100%', backgroundColor: COLORS.bgElevated, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barWeekLabel: { color: COLORS.textMuted, fontSize: 10 },
  muscleCard: { backgroundColor: COLORS.bgCard, borderRadius: 16 },
  muscleContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  muscleEmoji: { fontSize: 40 },
  muscleTitle: { color: COLORS.textMuted, fontSize: 13 },
  muscleName: { color: COLORS.text, fontWeight: 'bold' },
  analysisCard: { backgroundColor: `${COLORS.primary}15`, borderRadius: 16, borderWidth: 1, borderColor: `${COLORS.primary}40` },
  analysisLabel: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13, marginBottom: 12 },
  analysisSummary: { color: COLORS.text, lineHeight: 22, marginBottom: 12 },
  insightList: { gap: 6 },
  insightRow: { flexDirection: 'row', gap: 8 },
  insightDot: { color: COLORS.primary, fontWeight: 'bold', marginTop: 2 },
  insightText: { color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
});
