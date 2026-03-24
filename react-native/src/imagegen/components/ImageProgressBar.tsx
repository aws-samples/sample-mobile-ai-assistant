import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Animated, Easing, Image, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAppContext } from '../../history/AppProvider.tsx';
import { useTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedImage = Animated.createAnimatedComponent(Image);

const ProgressCircle = ({
  progressAnim,
  isDark,
}: {
  progressAnim: Animated.Value;
  isDark: boolean;
}) => {
  const size = 28;
  const strokeWidth = 2;
  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => radius * 2 * Math.PI, [radius]);
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });
  return (
    <Svg width={size} height={size}>
      <Circle
        stroke={isDark ? '#333333' : '#e6e6e6'}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        stroke={isDark ? '#e6e6e6' : '#333333'}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

const ImageProgressBar = () => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showFinishImage, setShowFinishImage] = useState(false);
  const { event } = useAppContext();
  const { isDark } = useTheme();

  const startProgressAnimation = useRef(
    useCallback(
      (toValue: number, duration: number) => {
        return Animated.timing(progressAnim, {
          toValue,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        });
      },
      [progressAnim]
    )
  ).current;

  useEffect(() => {
    if (event?.event === 'onImageComplete') {
      startProgressAnimation(100, 200).start();
      setShowFinishImage(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } else if (event?.event === 'onImageStop') {
      startProgressAnimation(100, 200).start();
    } else if (event?.event === 'onImageStart') {
      Animated.sequence([
        startProgressAnimation(70, 10000),
        startProgressAnimation(80, 10000),
        startProgressAnimation(95, 20000),
      ]).start();
    }
  }, [event, fadeAnim, startProgressAnimation]);

  React.useEffect(() => {
    fadeAnim.setValue(0);
    setShowFinishImage(false);
  }, [fadeAnim, progressAnim]);

  return (
    <View style={styles.container}>
      <ProgressCircle progressAnim={progressAnim} isDark={isDark} />
      {!showFinishImage && (
        <Image
          source={
            isDark
              ? require('../../assets/image_progress_dark.png')
              : require('../../assets/image_progress.png')
          }
          style={styles.image}
        />
      )}
      {showFinishImage && (
        <AnimatedImage
          source={
            isDark
              ? require('../../assets/done_dark.png')
              : require('../../assets/done.png')
          }
          style={[styles.image, { opacity: fadeAnim }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    position: 'relative',
  },
  image: {
    width: 18,
    height: 18,
    position: 'absolute',
  },
});

export default ImageProgressBar;
