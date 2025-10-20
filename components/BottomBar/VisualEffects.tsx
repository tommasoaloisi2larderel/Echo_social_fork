import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import {
    Animated,
    View
} from "react-native";

interface VisualEffectsProps {
  blurOpacity: Animated.AnimatedInterpolation<number>;
  MAX_TRANSLATE: number;
  sheetY: Animated.Value;
}

export default function VisualEffects({ blurOpacity }: VisualEffectsProps) {
  const particleAnim1 = useRef(new Animated.Value(0)).current;
  const particleAnim2 = useRef(new Animated.Value(0)).current;
  const particleAnim3 = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  // Animation loop for particles and glow
  useEffect(() => {
    const particleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const particle2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim2, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const particle3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim3, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim3, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    particleLoop.start();
    particle2Loop.start();
    particle3Loop.start();
    glowLoop.start();

    return () => {
      particleLoop.stop();
      particle2Loop.stop();
      particle3Loop.stop();
      glowLoop.stop();
    };
  }, []);

  const particle1Y = particleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const particle2Y = particleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -150],
  });

  const particle3Y = particleAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const particle1Opacity = particleAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const particle2Opacity = particleAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 0],
  });

  const particle3Opacity = particleAnim3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.9, 0],
  });

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return {
    glowScale,
    glowOpacity,
    ParticlesAndGradients: () => (
      <>
        {/* Particle 1 */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '20%',
            bottom: 150,
            opacity: Animated.multiply(blurOpacity, particle1Opacity),
            transform: [{ translateY: particle1Y }],
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: 'rgba(10, 145, 104, 0.4)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.8,
              shadowRadius: 20,
              elevation: 10,
            }}
          />
        </Animated.View>

        {/* Particle 2 */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: '15%',
            bottom: 180,
            opacity: Animated.multiply(blurOpacity, particle2Opacity),
            transform: [{ translateY: particle2Y }],
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(10, 145, 104, 0.5)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.9,
              shadowRadius: 15,
              elevation: 10,
            }}
          />
        </Animated.View>

        {/* Particle 3 */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '60%',
            bottom: 200,
            opacity: Animated.multiply(blurOpacity, particle3Opacity),
            transform: [{ translateY: particle3Y }],
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(10, 145, 104, 0.35)',
              shadowColor: 'rgba(10, 145, 104, 1)',
              shadowOpacity: 0.7,
              shadowRadius: 18,
              elevation: 10,
            }}
          />
        </Animated.View>

        {/* Glow effect behind panel */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 250,
            opacity: blurOpacity,
            zIndex: 500,
          }}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }}
          >
            <LinearGradient
              colors={[
                'rgba(10, 145, 104, 0)',
                'rgba(10, 145, 104, 0.1)',
                'rgba(10, 145, 104, 0.3)',
                'rgba(10, 145, 104, 0.5)',
              ]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </Animated.View>
        </Animated.View>

        {/* Main mysterious gradient */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 200,
            opacity: blurOpacity,
            zIndex: 1000,
          }}
        >
          <LinearGradient
            colors={[
              'rgba(10, 145, 104, 0)',
              'rgba(10, 145, 104, 0.0)',
              'rgba(10, 145, 104, 0.2)',
              'rgba(10, 145, 104, 0.4)',
            ]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>
      </>
    )
  };
}