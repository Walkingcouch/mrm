// Home: header + hamburger (from the drawer layout) and the logo on an
// otherwise blank page. Nothing else may ever render here — no messages,
// banners, overlays or redirects (acceptance A).
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';

export default function Home() {
  return (
    <View style={styles.page} testID="home">
      <Image
        // PLACEHOLDER: replace assets/brand/logo.png with the authorised Glencore logo supplied by the owner.
        source={require('../../../assets/brand/logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Glencore"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: '70%', maxWidth: 320, aspectRatio: 3 },
});
