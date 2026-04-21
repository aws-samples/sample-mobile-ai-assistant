import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme, ColorScheme } from '../../../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { isMac } from '../../../App.tsx';
import { voiceChatService } from '../../service/VoiceChatService.ts';

export interface AudioWaveformRef {
  resetAudioLevels: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const minWidth = screenWidth > screenHeight ? screenHeight : screenWidth;
const isPad = minWidth > 434;

const AudioWaveformComponent = React.forwardRef<AudioWaveformRef>(
  (props, ref) => {
    const { colors } = useTheme();
    const [colorOffset, setColorOffset] = useState(0);
    const barCountRef = useRef(isMac || isPad ? 48 : 32);
    const barValues = Array(barCountRef.current)
      .fill(0)
      // eslint-disable-next-line react-hooks/rules-of-hooks
      .map(() => useSharedValue(0.3));
    const inputAudioLevelRef = useRef(1);
    const outputAudioLevelRef = useRef(1);
    const [audioVolume, setAudioVolume] = useState<number>(1); // Audio volume level (1-10)

    useEffect(() => {
      // Set up voice chat service callbacks
      voiceChatService.setOnAudioLevelCallbacks(
        // Handle audio level changes
        (source, level) => {
          if (source === 'microphone') {
            inputAudioLevelRef.current = level;
          } else {
            outputAudioLevelRef.current = level;
          }
          const maxLevel = Math.max(
            inputAudioLevelRef.current,
            outputAudioLevelRef.current
          );
          setAudioVolume(maxLevel);
        }
      );
    }, []);

    // Add reset method for audio levels
    const resetAudioLevels = useCallback(() => {
      inputAudioLevelRef.current = 1;
      outputAudioLevelRef.current = 1;
    }, []);

    // Expose methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        resetAudioLevels,
      }),
      [resetAudioLevels]
    );

    // Gradient colors from blue to green to purple
    const gradientColors = [
      '#4158D0',
      '#4B5EE8',
      '#5564FF',
      '#5F6CFF',
      '#6975FF',
      '#737EFF',
      '#7D87FF',
      '#8790FF',
      '#90A0FF',
      '#8BAFFF',
      '#86BEFF',
      '#80CDFF',
      '#7ADCFF',
      '#74EBFF',
      '#6EFAFF',
      '#68FFFC',
      '#60F5F0',
      '#58F0E0',
      '#50EBD0',
      '#48E6C0',
      '#40E1B0',
      '#38DCA0',
      '#30D790',
      '#29D280',
      '#21CD70',
      '#41D46C',
      '#61DB68',
      '#81E264',
      '#A1E960',
      '#B0ED5C',
      '#C0F158',
      '#D0F554',
      '#C8F050',
      '#BEC24C',
      '#B49448',
      '#AA6644',
      '#A03840',
      '#963A60',
      '#8C3C80',
      '#823EA0',
      '#7840C0',
      '#7E4CD8',
      '#8458F0',
      '#8A64FF',
      '#9070FF',
      '#967CFF',
      '#9C88FF',
      '#4158D0',
    ];

    // Color animation effect - updates every 500ms
    useEffect(() => {
      const colorAnimationInterval = setInterval(() => {
        setColorOffset(prev => (prev + 1) % gradientColors.length);
      }, 500);

      return () => clearInterval(colorAnimationInterval);
    }, [gradientColors.length]);

    // Update waveform when volume changes
    useEffect(() => {
      // Special handling for volume=1 (silent or not recording)
      if (audioVolume === 1) {
        barValues.forEach(bar => {
          // Fixed low height for all bars
          const minHeight = 0.05;

          bar.value = withTiming(minHeight, {
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          });
        });
        return;
      }

      // For volume > 1, animate based on volume level
      const baseIntensity = audioVolume / 10;

      barValues.forEach((bar, index) => {
        const centerEffect =
          1 -
          Math.abs(
            (index - barCountRef.current / 2) / (barCountRef.current / 2)
          ) *
            0.5;
        const randomHeight =
          (Math.random() * 0.6 + 0.2) * baseIntensity * centerEffect;
        const delay = index * 10;

        bar.value = withSequence(
          withTiming(randomHeight, {
            duration: 180 + delay,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          withTiming(0.05 + Math.random() * 0.15 * baseIntensity, {
            duration: 220 + delay,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          })
        );
      });
    }, [barValues, audioVolume]);

    const animatedBarStyles = barValues.map(bar =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useAnimatedStyle(() => ({
        height: `${bar.value * 100}%`,
        opacity: 0.7 + bar.value * 0.3,
      }))
    );

    const styles = createStyles(colors);

    return (
      <View style={styles.container}>
        <View style={styles.waveformContainer}>
          {barValues.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                animatedBarStyles[index],
                {
                  backgroundColor:
                    gradientColors[
                      (index + colorOffset) % gradientColors.length
                    ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }
);

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      height: 44,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    waveformContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      width: '100%',
    },
    bar: {
      width: 3,
      borderRadius: 3,
      minHeight: 1,
    },
    baselineContainer: {
      position: 'absolute',
      bottom: '50%',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    baseline: {
      height: 1,
      width: '95%',
      backgroundColor: 'rgba(120, 120, 255, 0.3)',
    },
  });

export default AudioWaveformComponent;
