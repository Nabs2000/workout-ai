import { useState, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../../stores/userStore';
import { api } from '../../services/api';
import { COLORS } from '../../constants';
import { getCurrentWeek } from '../../services/dateUtils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  analysisResult?: {
    adherencePercent: number;
    planAdjusted: boolean;
  };
}

const QUICK_PROMPTS = [
  'Analyze my week',
  'Adjust my plan — I was sick',
  'Make next week harder',
  'Focus more on legs',
];

export default function CoachScreen() {
  const qc = useQueryClient();
  const { userId } = useUserStore();
  const { week, year } = getCurrentWeek();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hey! I'm your FitCoach AI, powered by Amazon Nova. I can analyze your workout progress, tell you if your plan is on track, and adjust it for next week. How can I help?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: (prompt: string) => {
      // For "analyze" intents, run the weekly analysis agent
      const isAnalysis = /analyz|on track|how.*doing|progress/i.test(prompt);
      if (isAnalysis) {
        return api.analyze.runWeekly(userId!, week, year);
      }
      // For plan adjustment prompts, still run analysis (which triggers adjustment)
      return api.analyze.runWeekly(userId!, week, year);
    },
    onSuccess: (result, prompt) => {
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['analysis'] });

      let content = result.summary;
      if (result.keyInsights.length > 0) {
        content += '\n\n**Key insights:**\n' + result.keyInsights.map((i) => `• ${i}`).join('\n');
      }
      if (result.planAdjusted) {
        content += `\n\n✅ I've updated your training plan for next week based on this analysis.`;
      }

      addMessage('assistant', content, {
        adherencePercent: result.adherencePercent,
        planAdjusted: result.planAdjusted,
      });
    },
    onError: (e: any) => {
      addMessage('assistant', `Sorry, I ran into an issue: ${e.message ?? 'Unknown error'}. Make sure your backend is running.`);
    },
  });

  function addMessage(
    role: Message['role'],
    content: string,
    analysisResult?: Message['analysisResult'],
  ) {
    const msg: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      analysisResult,
    };
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function send(text?: string) {
    const prompt = (text ?? input).trim();
    if (!prompt) return;
    setInput('');
    addMessage('user', prompt);
    analyzeMutation.mutate(prompt);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
          <View>
            <Text variant="titleMedium" style={styles.headerTitle}>Nova Coach</Text>
            <Text variant="bodySmall" style={styles.headerSub}>Amazon Nova · Agentic AI</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageArea}
        contentContainerStyle={styles.messageContent}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {analyzeMutation.isPending && (
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>Nova is thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <ScrollView
          horizontal
          contentContainerStyle={styles.quickPrompts}
          showsHorizontalScrollIndicator={false}
        >
          {QUICK_PROMPTS.map((p) => (
            <Chip
              key={p}
              onPress={() => send(p)}
              style={styles.quickChip}
              textStyle={styles.quickChipText}
            >
              {p}
            </Chip>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach..."
          style={styles.textInput}
          onSubmitEditing={() => send()}
          right={
            <TextInput.Icon
              icon="send"
              color={input.trim() ? COLORS.primary : COLORS.textMuted}
              onPress={() => send()}
            />
          }
          disabled={analyzeMutation.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  // Simple markdown-like formatting: **bold** and bullet lists
  const lines = message.content.split('\n');

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      {lines.map((line, i) => {
        if (line.startsWith('• ')) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, isUser && styles.userText]}>•</Text>
              <Text style={[styles.bulletText, isUser && styles.userText]}>{line.slice(2)}</Text>
            </View>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <Text key={i} style={[styles.boldLine, isUser && styles.userText]}>
              {line.slice(2, -2)}
            </Text>
          );
        }
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        return (
          <Text key={i} style={[styles.msgText, isUser && styles.userText]}>
            {line}
          </Text>
        );
      })}
      {message.analysisResult && (
        <View style={styles.resultChips}>
          <Chip
            compact
            style={[styles.resultChip, { backgroundColor: `${COLORS.primary}30` }]}
            textStyle={{ color: COLORS.primary, fontSize: 11 }}
          >
            {message.analysisResult.adherencePercent}% adherence
          </Chip>
          {message.analysisResult.planAdjusted && (
            <Chip
              compact
              style={[styles.resultChip, { backgroundColor: `${COLORS.success}30` }]}
              textStyle={{ color: COLORS.success, fontSize: 11 }}
            >
              Plan updated
            </Chip>
          )}
        </View>
      )}
      <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22 },
  headerTitle: { color: COLORS.text, fontWeight: 'bold' },
  headerSub: { color: COLORS.textMuted },
  messageArea: { flex: 1 },
  messageContent: { padding: 16, gap: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    gap: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bgCard,
    borderBottomLeftRadius: 4,
  },
  msgText: { color: COLORS.text, lineHeight: 20, fontSize: 15 },
  userText: { color: COLORS.text },
  boldLine: { color: COLORS.text, fontWeight: 'bold', lineHeight: 22, fontSize: 15 },
  bulletRow: { flexDirection: 'row', gap: 6 },
  bulletDot: { color: COLORS.primary, fontWeight: 'bold', width: 12 },
  bulletText: { color: COLORS.text, flex: 1, lineHeight: 20 },
  timestamp: { color: COLORS.textMuted, fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  userTimestamp: { color: 'rgba(255,255,255,0.6)' },
  resultChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  resultChip: { height: 24 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bgCard,
    padding: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    maxWidth: '60%',
  },
  typingText: { color: COLORS.textSecondary, fontSize: 14 },
  quickPrompts: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  quickChip: { backgroundColor: COLORS.bgCard, borderColor: COLORS.border },
  quickChipText: { color: COLORS.textSecondary },
  inputRow: {
    padding: 12,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: { backgroundColor: COLORS.bgElevated },
});
