import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

interface SwipeableContainerProps {
  children: [React.ReactNode, React.ReactNode, React.ReactNode]; // Exactly 3 children
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  controlRef?: React.RefObject<SwipeableContainerHandle>;
}

export interface SwipeableContainerHandle {
  scrollToIndex: (index: number) => void;
}

export default function SwipeableContainer({
  children,
  initialIndex = 1,
  onIndexChange,
  controlRef,
}: SwipeableContainerProps) {
  const pageCount = children.length;
  const [width, setWidth] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(Math.min(Math.max(initialIndex, 0), pageCount - 1));
  const scrollRef = useRef<ScrollView | null>(null);
  const didInitRef = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) {
      setWidth(w);
    }
  };

  // Ensure we start at the intended page once width is known (Android sometimes ignores contentOffset)
  useEffect(() => {
    if (!didInitRef.current && width > 0 && scrollRef.current) {
      didInitRef.current = true;
      const x = currentIndex * width;
      scrollRef.current.scrollTo({ x, y: 0, animated: false });
    }
  }, [width, currentIndex]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(width > 0 ? x / width : 0);
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      onIndexChange?.(idx);
    }
  };

  // Exposer la méthode scrollToIndex via le ref
  useImperativeHandle(controlRef, () => ({
    scrollToIndex: (index: number) => {
      if (scrollRef.current && width > 0) {
        const clampedIndex = Math.min(Math.max(index, 0), pageCount - 1);
        const x = clampedIndex * width;
        scrollRef.current.scrollTo({ x, y: 0, animated: true });
        setCurrentIndex(clampedIndex);
        onIndexChange?.(clampedIndex);
      }
    },
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Keep behavior consistent across platforms
          decelerationRate={"fast"}
          snapToInterval={width}
          snapToAlignment="center"
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          style={styles.scroll}
        >
          <View style={[styles.page, { width }]}>{children[0]}</View>
          <View style={[styles.page, { width }]}>{children[1]}</View>
          <View style={[styles.page, { width }]}>{children[2]}</View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  page: { flex: 1 },
});