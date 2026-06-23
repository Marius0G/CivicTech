// Screen 6 · Hop chat (chatscreen.png) — conversational buddy.
// Visual match + working text composer (appends a bubble, shows typing, then a Hop reply).
// The mic hands off to the realtime voice engine via onMic.

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mascot from '../Mascot';
import Icon from '../ui/Icon';
import { sendChat, ChatMessage } from '../chat';
import { colors, fonts, langSwitchReserve, radius, space } from '../theme';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

type Msg = { from: 'hop' | 'me'; text: string };

const buildSeed = (t: TFn): Msg[] => [
  { from: 'hop', text: t('chat.seedGreeting') },
];

const buildQuick = (t: TFn) => [
  t('chat.quickErasmusDeadlines'),
  t('chat.quickFindGrant'),
  t('chat.quickEuYouthRights'),
];

export default function ChatScreen({ onBack, onMic }: { onBack: () => void; onMic: () => void }) {
  const { t } = useTranslation();
  const [msgs, setMsgs] = useState<Msg[]>(() => buildSeed(t));
  const [typing, setTyping] = useState(false);
  const [val, setVal] = useState('');
  const scroller = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [msgs, typing]);

  async function send(text?: string) {
    const trimmed = (text ?? val).trim();
    if (!trimmed || typing) return;
    const next: Msg[] = [...msgs, { from: 'me', text: trimmed }];
    setMsgs(next);
    setVal('');
    setTyping(true);
    try {
      // Send the real history (mapped to chat roles) to the backend RAG chat.
      const history: ChatMessage[] = next.map((m) => ({
        role: m.from === 'me' ? 'user' : 'assistant',
        content: m.text,
      }));
      const res = await sendChat(history);
      setMsgs((m) => [...m, { from: 'hop', text: res.reply || '…' }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { from: 'hop', text: t('chat.reachError', { error: e.message ?? e }) }]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + space.s2 }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}><Icon name="arrow-left" size={22} /></Pressable>
        <Mascot speaking={false} celebrate={false} size={40} />
        <View style={styles.flex}>
          <Text style={styles.name}>Hop</Text>
          <Text style={styles.presence}><Text style={{ color: colors.primary }}>● </Text>{t('chat.presenceOnline')}</Text>
        </View>
        <Pressable hitSlop={10} style={styles.iconBtn}><Icon name="phone" size={20} color={colors.textSecondary} /></Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
        <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.msgs}>
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubble, m.from === 'me' ? styles.me : styles.hop]}>
              <Text style={[styles.msgText, m.from === 'me' && styles.meText]}>{m.text}</Text>
            </View>
          ))}
          {typing && (
            <View style={[styles.bubble, styles.hop, styles.typing]}>
              <Text style={styles.msgText}>{t('chat.typing')}</Text>
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: space.s3 + insets.bottom }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
            {buildQuick(t).map((q) => (
              <Pressable key={q} style={styles.chip} onPress={() => send(q)}>
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <Pressable style={styles.plus}><Icon name="plus" size={24} color={colors.textSecondary} /></Pressable>
            <View style={styles.inputPill}>
              <TextInput
                value={val}
                onChangeText={setVal}
                placeholder={t('chat.inputPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                onSubmitEditing={() => send()}
                returnKeyType="send"
              />
            </View>
            <Pressable style={styles.plus} onPress={onMic}><Icon name="mic" size={22} color={colors.textSecondary} /></Pressable>
            <Pressable style={styles.send} onPress={() => send()}>
              <Icon name="arrow-up" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfacePage },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    // Keep the right edge clear for the global language switcher (floats above every screen).
    paddingLeft: space.s4, paddingRight: langSwitchReserve, paddingBottom: space.s2,
    backgroundColor: colors.surfaceCard, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.textPrimary, fontSize: 22 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16 },
  presence: { color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 12, marginTop: 1 },

  msgs: { padding: space.s4, gap: space.s3 },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: space.s4, paddingVertical: space.s3 },
  hop: { alignSelf: 'flex-start', backgroundColor: colors.surfaceCard, borderTopLeftRadius: 4 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderTopRightRadius: 4 },
  typing: { opacity: 0.7 },
  msgText: { color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  meText: { color: colors.onPrimary, fontFamily: fonts.sansMedium },

  composer: {
    paddingHorizontal: space.s3, paddingTop: space.s2, paddingBottom: space.s3,
    backgroundColor: colors.surfaceCard, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  quick: { gap: space.s2, paddingBottom: space.s2, paddingHorizontal: space.s1 },
  chip: {
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.pill, paddingHorizontal: space.s3, paddingVertical: 7,
  },
  chipText: { color: colors.textSecondary, fontFamily: fonts.sansSemibold, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  plus: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputPill: {
    flex: 1, height: 48, justifyContent: 'center', paddingHorizontal: space.s4,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.pill,
  },
  input: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 15, padding: 0 },
  send: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: colors.onPrimary, fontSize: 20, fontFamily: fonts.sansBold },
});
