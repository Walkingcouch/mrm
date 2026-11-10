// Home: header + hamburger (from the drawer layout), the logo on an otherwise
// blank page, and the decorative teal band at the foot, as in the current app.
// Nothing else may ever render here — no messages, banners, overlays or
// redirects (acceptance A). The band is static decoration, never content.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page} testID="home">
      <View style={styles.centre}>
        <Image
          // PLACEHOLDER: replace assets/brand/logo.png with the authorised Glencore logo supplied by the owner.
          source={require('../../../assets/brand/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Glencore"
        />
      </View>
      <View style={[styles.band, { height: 28 + insets.bottom }]} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: '50%', maxWidth: 260, aspectRatio: 3 },
  band: { backgroundColor: colors.teal },
});
