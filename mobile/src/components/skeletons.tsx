import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Radius, Space } from '@/constants/design-system';
import { useTheme } from '@/hooks/use-theme';

type BlockProps = { width?: ViewStyle['width']; height?: number; radius?: number; style?: ViewStyle };

export function SkeletonBlock({ width = '100%', height = 16, radius = Radius.card, style }: BlockProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0.55);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 700 }), withTiming(0.45, { duration: 700 })),
      -1,
      true,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, style, animatedStyle]}
    />
  );
}

export function SkeletonText({ width = '100%', height = 14 }: Pick<BlockProps, 'width' | 'height'>) {
  return <SkeletonBlock width={width} height={height} radius={Radius.pill} />;
}

/** Placeholder rows for review, notification, and other vertical lists. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.listCard}>
          <View style={styles.row}>
            <SkeletonBlock width={40} height={40} radius={Radius.pill} />
            <View style={styles.flex}>
              <SkeletonText width="58%" />
              <SkeletonText width="35%" height={12} />
            </View>
          </View>
          <SkeletonText height={14} />
          <SkeletonText width="82%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder cards for the Explore and Library grids. */
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.gridCard}>
          <SkeletonBlock height={180} radius={Radius.cover} />
          <SkeletonText width="78%" />
          <SkeletonText width="52%" height={12} />
        </View>
      ))}
    </View>
  );
}

/** Four cover placeholders matching the Home's horizontal book shelves. */
export function SkeletonBookShelf({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.shelf}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.shelfBook}>
          <SkeletonBlock width={112} height={168} radius={Radius.cover} />
          <SkeletonText width={100} />
          <SkeletonText width={76} height={12} />
        </View>
      ))}
    </View>
  );
}

/** Data-area placeholder for a book detail. The screen keeps its back/header chrome. */
export function SkeletonBookDetail() {
  return (
    <View style={styles.detail}>
      <SkeletonBlock width="72%" height={240} radius={Radius.cover} style={styles.centered} />
      <View style={styles.row}>
        <SkeletonBlock width={76} height={28} radius={Radius.pill} />
        <SkeletonBlock width={86} height={28} radius={Radius.pill} />
        <SkeletonBlock width={70} height={28} radius={Radius.pill} />
      </View>
      <SkeletonText width="78%" height={25} />
      <SkeletonText width="42%" />
      <SkeletonBlock height={96} />
      <SkeletonBlock height={52} />
      <SkeletonList count={2} />
    </View>
  );
}

/** Fields for the profile data area. */
export function SkeletonProfileFields() {
  return (
    <View style={styles.profile}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.profileField}>
          <SkeletonText width="36%" height={12} />
          <SkeletonText width="68%" height={18} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.three },
  listCard: { gap: Space.three, padding: Space.four, borderRadius: Radius.card, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.three },
  flex: { flex: 1, gap: Space.two },
  grid: { gap: Space.three },
  gridCard: { gap: Space.two, paddingBottom: Space.two },
  shelf: { flexDirection: 'row', gap: Space.four },
  shelfBook: { gap: Space.two },
  detail: { gap: Space.four },
  centered: { alignSelf: 'center' },
  profile: { gap: 0, borderRadius: Radius.card, overflow: 'hidden' },
  profileField: { gap: Space.two, paddingVertical: Space.four },
});
