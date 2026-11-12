import React from 'react';
import { Text, StyleSheet, Pressable, View, useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useContent } from '@/lib/content-context';
import { appTitle, colors, fonts, sectionIcons } from '@/lib/theme';
import { MenuBackButton, headerStyle } from '@/components/Header';

// Menu as in the current app: light grey panel, teal outline icon + teal label per item.
function Menu(props: DrawerContentComponentProps) {
  const { sections } = useContent();
  const pathname = usePathname();
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.drawer }} contentContainerStyle={{ paddingTop: 4 }}>
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
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons name={sectionIcons[s.key] ?? 'circle-outline'} size={28} color={colors.teal} />
            </View>
            <Text style={styles.label}>{s.label}</Text>
          </Pressable>
        );
      })}
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  const { sections } = useContent();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.round(Math.min(360, Math.max(260, width * 0.6)));
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
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 10, paddingLeft: 8, paddingRight: 12, gap: 12 },
  itemActive: { backgroundColor: colors.tealSoft },
  icon: { width: 32, alignItems: 'center' },
  label: { flex: 1, color: colors.tealText, fontSize: 19, fontFamily: fonts.regular },
});
