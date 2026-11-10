import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

export function Centered({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.centered, style]}>{children}</View>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </Centered>
  );
}

export function Notice({ title, body, actionLabel, onAction }: {
  title: string; body?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <Centered>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Centered>
  );
}

export function Button({ label, onPress, kind = 'primary' }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, kind === 'secondary' && styles.buttonSecondary, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ title, subtitle, onPress, trailing, unseen }: {
  title: string; subtitle?: string; onPress?: () => void; trailing?: string; unseen?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      {unseen !== undefined ? <View style={[styles.dot, !unseen && { backgroundColor: 'transparent' }]} accessibilityLabel={unseen ? 'Not yet opened' : undefined} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 15 },
  title: { color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  button: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, minHeight: 56,
         borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, backgroundColor: colors.background, gap: 12 },
  rowTitle: { color: colors.text, fontSize: 16 },
  rowSubtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  trailing: { color: colors.accent, fontSize: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
