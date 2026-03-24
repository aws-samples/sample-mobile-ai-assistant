import React, { useEffect } from 'react';
import { StyleSheet, Image, ImageSourcePropType, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface ImageSpinnerProps {
  size?: number;
  source: ImageSourcePropType;
  visible: boolean;
  isRotate?: boolean;
}

const ImageSpinner = ({
  size = 24,
  source,
  visible,
  isRotate = false,
}: ImageSpinnerProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 600,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [visible, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${isRotate ? '-' : ''}${rotation.value}deg` }], // Negative value for clockwise rotation
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={source}
          style={{
            width: size,
            height: size,
            transform: [{ scaleY: isRotate ? -1 : 1 }, { scaleX: 1 }],
          }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImageSpinner;
