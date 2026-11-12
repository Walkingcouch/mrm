// Inline preview of an image attached to a message. Tapping opens it full
// screen (zoomable). If the phone can't show the format (e.g. HEIC on some
// Android phones) it falls back to a plain row that still opens the file.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Row } from './ui';
import { colors, fonts } from '@/lib/theme';

export function ImagePreview({ uri, name, onOpen }: { uri: string; name: string; onOpen: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  if (failed) return <Row title={name} trailing="›" icon="image-outline" onPress={onOpen} />;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${name}. Opens full screen.`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          // Keep the picture's shape, but never taller than square-ish or flatter than a banner.
          if (width && height) setRatio(Math.min(Math.max(width / height, 0.8), 2.5));
        }}
        onError={() => setFailed(true)}
        style={[styles.image, { aspectRatio: ratio ?? 4 / 3 }]}
      />
      <View style={styles.caption}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <MaterialCommunityIcons name="arrow-expand" size={18} color={colors.teal} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F1F1', marginTop: 8, marginBottom: 8 },
  image: { width: '100%', backgroundColor: '#E4E4E4' },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  name: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },
});
