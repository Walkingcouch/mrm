import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '@/lib/theme';

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
      <Text style={[styles.buttonText, kind === 'secondary' && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Row({ title, subtitle, onPress, trailing, unseen, icon }: {
  title: string; subtitle?: string; onPress?: () => void; trailing?: string; unseen?: boolean; icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#E4E4E4' }]}
    >
      {icon ? (
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons name={icon} size={30} color={colors.teal} />
          {unseen ? <View style={styles.dot} accessibilityLabel="Not yet opened" /> : null}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle} numberOfLines={3}>{subtitle}</Text> : null}
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 15, fontFamily: fonts.regular },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.semibold, textAlign: 'center' },
  body: { color: colors.muted, fontSize: 15, fontFamily: fonts.regular, textAlign: 'center' },
  button: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.text, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 6, minHeight: 48, justifyContent: 'center', alignSelf: 'stretch' },
  buttonSecondary: { backgroundColor: colors.background, borderColor: colors.text },
  buttonText: { color: colors.text, fontSize: 17, fontFamily: fonts.regular, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 8, paddingRight: 16, minHeight: 56,
         borderBottomWidth: 1, borderBottomColor: colors.rowDivider, backgroundColor: colors.row, gap: 12 },
  rowIcon: { width: 34, alignItems: 'center' },
  rowTitle: { color: colors.text, fontSize: 19, fontFamily: fonts.regular },
  rowSubtitle: { color: colors.muted, fontSize: 14, fontFamily: fonts.regular, marginTop: 2 },
  trailing: { color: colors.muted, fontSize: 18 },
  dot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.row },
});
