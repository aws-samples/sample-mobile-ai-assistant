import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import { Usage } from '../../types/Chat.ts';
import { useTheme, ColorScheme } from '../../theme';

interface HeaderTitleProps {
  title: string;
  usage?: Usage;
  onDoubleTap: () => void;
}

const HeaderTitle: React.FC<HeaderTitleProps> = ({
  title,
  usage,
  onDoubleTap,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [showUsage, setShowUsage] = useState(false);
  const doubleTapRef = useRef(null);

  const handleSingleTap = () => {
    setShowUsage(!showUsage);
  };

  return (
    <TapGestureHandler
      ref={doubleTapRef}
      numberOfTaps={2}
      onHandlerStateChange={({ nativeEvent }) => {
        if (nativeEvent.state === State.ACTIVE) {
          onDoubleTap();
        }
      }}>
      <TapGestureHandler
        numberOfTaps={1}
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE) {
            handleSingleTap();
          }
        }}
        waitFor={doubleTapRef}>
        <View style={styles.container}>
          <Text style={styles.headerTitleStyle}>{title}</Text>
          {showUsage && title !== 'Image' && (
            <Text style={styles.usageText}>{`Input: ${
              usage?.inputTokens ?? 0
            }   Output: ${usage?.outputTokens ?? 0}`}</Text>
          )}
        </View>
      </TapGestureHandler>
    </TapGestureHandler>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    headerTitleStyle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    usageText: {
      fontSize: 10,
      color: colors.textSecondary,
      marginLeft: 4,
      fontWeight: '400',
    },
  });

export default HeaderTitle;
