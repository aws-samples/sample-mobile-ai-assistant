import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { isAndroid } from '../../../utils/PlatformUtils';
import { useTheme, ColorScheme } from '../../../theme';
import { trigger } from '../../../core/HapticUtils';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types';

interface CitationBadgeProps {
  number: number;
  url: string;
}

const CitationBadge: React.FC<CitationBadgeProps> = ({ number, url }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = async () => {
    trigger(HapticFeedbackTypes.impactLight);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.badge}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={handlePress}>
      <Text style={styles.badgeText}>{number}</Text>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    badge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.citationBadgeBackground,
      justifyContent: 'center',
      alignItems: 'center',
      transform: isAndroid ? [{ translateY: 3 }] : [],
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.citationBadgeText,
    },
  });

export default CitationBadge;
