import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Drawer, type DrawerContentComponentProps } from 'expo-router/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useContent } from '@/lib/content-context';
import { appTitle, colors, fonts, sectionIcons } from '@/lib/theme';
import { MenuBackButton, headerStyle } from '@/components/Header';

// Menu as in the current app: light grey panel, teal outline icon + teal label per item.
// The panel draws its own safe areas: the first item sits below the status bar /
// notch / Dynamic Island, and the last item clears the home indicator or
// Android gesture bar. Text scales with the phone's text size, within limits.
function Menu(props: DrawerContentComponentProps) {
  const { sections } = useContent();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.panel}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingLeft: insets.left }}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((s) => {
          const href = s.key === 'home' ? '/' : `/section/${s.key}`;
          const active = pathname === href;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
              onPress={() => {
                props.navigation.closeDrawer();
                if (s.key === 'home') router.navigate('/');
                else router.navigate({ pathname: '/section/[key]', params: { key: s.key } });
              }}
              android_ripple={{ color: colors.tealSoft }}
              style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && Platform.OS === 'ios' && { opacity: 0.6 }]}
            >
              <View style={styles.icon}>
                <MaterialCommunityIcons name={sectionIcons[s.key] ?? 'circle-outline'} size={24} color={colors.teal} />
              </View>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function DrawerLayout() {
  const { sections } = useContent();
  const { width } = useWindowDimensions();
  // About 3/4 of a phone screen (as on iOS and Android system menus), never wider than 320.
  const drawerWidth = Math.round(Math.min(320, width * 0.78));
  return (
    <Drawer
      drawerContent={(p) => <Menu {...p} />}
      screenOptions={{
        ...headerStyle,
        drawerType: 'front',
        drawerStyle: { backgroundColor: colors.drawer, width: drawerWidth },
        overlayColor: 'rgba(0,0,0,0.08)',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Drawer.Screen name="index" options={{ title: appTitle }} />
      <Drawer.Screen
        name="section/[key]"
        options={({ route, navigation }) => {
          const key = (route.params as { key?: string } | undefined)?.key;
          return {
            title: sections.find((s) => s.key === key)?.label ?? appTitle,
            // "‹ Menu" brings the menu back up (Home is its first item).
            headerLeft: () => <MenuBackButton onPress={() => navigation.openDrawer()} />,
          };
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.drawer },
  item: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 7,
    marginHorizontal: 8, paddingLeft: 12, paddingRight: 12, gap: 14, borderRadius: 10,
  },
  itemActive: { backgroundColor: colors.tealSoft },
  icon: { width: 26, alignItems: 'center' },
  label: { flex: 1, color: colors.tealText, fontSize: 17, fontFamily: fonts.regular },
  labelActive: { fontFamily: fonts.semibold },
});
