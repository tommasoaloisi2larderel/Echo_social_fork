import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ECHO_COLOR } from '../../constants/colors';

interface JarvisEdgeGlowProps {
  active: boolean;
}

export default function JarvisEdgeGlow({ active }: JarvisEdgeGlowProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      // Start the pulsing animation
      opacity.value = withRepeat(
        withTiming(1, {
          duration: 2000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        -1,
        true
      );
    } else {
      // Fade out when inactive
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!active) return null;

  // Extract RGB values from ECHO_COLOR for gradient
  // ECHO_COLOR is "rgba(10, 145, 104, 0.8)"
  const glowColor1 = 'rgba(10, 145, 104, 0)';
  const glowColor2 = 'rgba(10, 145, 104, 0.6)';
  const glowColor3 = 'rgba(10, 145, 104, 0.9)';
  const glowColor4 = 'rgba(10, 145, 104, 0.6)';

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      {/* Top Edge */}
      <LinearGradient
        colors={[glowColor3, glowColor2, glowColor1]}
        style={styles.topEdge}
        pointerEvents="none"
      />

      {/* Right Edge */}
      <LinearGradient
        colors={[glowColor1, glowColor2, glowColor3, glowColor2, glowColor1]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        style={styles.rightEdge}
        pointerEvents="none"
      />

      {/* Bottom Edge */}
      <LinearGradient
        colors={[glowColor1, glowColor2, glowColor3]}
        style={styles.bottomEdge}
        pointerEvents="none"
      />

      {/* Left Edge */}
      <LinearGradient
        colors={[glowColor1, glowColor2, glowColor3, glowColor2, glowColor1]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        style={styles.leftEdge}
        pointerEvents="none"
      />

      {/* Corner Glows for extra polish */}
      <View style={styles.cornerTopLeft} pointerEvents="none">
        <LinearGradient
          colors={[glowColor3, glowColor1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cornerGradient}
        />
      </View>

      <View style={styles.cornerTopRight} pointerEvents="none">
        <LinearGradient
          colors={[glowColor3, glowColor1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cornerGradient}
        />
      </View>

      <View style={styles.cornerBottomLeft} pointerEvents="none">
        <LinearGradient
          colors={[glowColor3, glowColor1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.cornerGradient}
        />
      </View>

      <View style={styles.cornerBottomRight} pointerEvents="none">
        <LinearGradient
          colors={[glowColor3, glowColor1]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.cornerGradient}
        />
      </View>
    </Animated.View>
  );
}

const EDGE_WIDTH = 5;
const CORNER_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: EDGE_WIDTH,
  },
  rightEdge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: EDGE_WIDTH,
  },
  bottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: EDGE_WIDTH,
  },
  leftEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: EDGE_WIDTH,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerGradient: {
    flex: 1,
  },
});
