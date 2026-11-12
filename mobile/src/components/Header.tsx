import React from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '@/lib/theme';

/** "‹ Back" in teal, as in the current app, on both platforms. */
export function BackButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
      style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8, minHeight: 44 }}>
      <MaterialCommunityIcons name="chevron-left" size={26} color={colors.tealText} />
      <Text style={{ color: colors.tealText, fontFamily: fonts.regular, fontSize: 17 }}>Back</Text>
    </Pressable>
  );
}

/**
 * On menu sections (HR & Payroll, Wellbeing…): "‹ Menu" in teal, which brings
 * the menu back up, where Home is the first item.
 */
export function MenuBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={12} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 8, minHeight: 44 }}>
      <MaterialCommunityIcons name="chevron-left" size={26} color={colors.tealText} />
      <Text style={{ color: colors.tealText, fontFamily: fonts.regular, fontSize: 17 }}>Menu</Text>
    </Pressable>
  );
}

export const headerStyle = {
  headerStyle: { backgroundColor: colors.header },
  headerTintColor: colors.headerText,
  headerTitleAlign: 'center' as const,
  headerTitleStyle: { fontFamily: fonts.regular, fontSize: 18, color: colors.headerText, fontWeight: '400' as const },
  headerShadowVisible: true,
};

