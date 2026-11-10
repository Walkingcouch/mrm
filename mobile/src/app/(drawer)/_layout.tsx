import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useContent } from '@/lib/content-context';
import { appTitle, colors } from '@/lib/theme';

function Menu(props: DrawerContentComponentProps) {
  const { sections } = useContent();
  const pathname = usePathname();
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
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
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.marker, active && { backgroundColor: colors.accent }]} />
            <Text style={[styles.label, active && { color: colors.accent, fontWeight: '600' }]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout() {
  const { sections } = useContent();
  return (
    <Drawer
      drawerContent={(p) => <Menu {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.headerText,
        headerTitleAlign: 'center',
        drawerType: 'front',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Drawer.Screen name="index" options={{ title: appTitle }} />
      <Drawer.Screen
        name="section/[key]"
        options={({ route }) => {
          const key = (route.params as { key?: string } | undefined)?.key;
          return { title: sections.find((s) => s.key === key)?.label ?? appTitle };
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 12, paddingRight: 16, gap: 12 },
  itemActive: { backgroundColor: '#EEF7F6' },
  marker: { width: 4, alignSelf: 'stretch', backgroundColor: 'transparent' },
  label: { flex: 1, color: colors.text, fontSize: 16 },
});
