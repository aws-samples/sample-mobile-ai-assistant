import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  StatusBar,
  Platform,
  Animated,
  NativeModules,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../../types/RouteTypes';
import { HeaderLeftView } from '../../prompt/HeaderLeftView';
import { useTheme, ColorScheme } from '../../theme';
import AIWebView from '../components/AIWebView';

const { NavigationBarModule } = NativeModules;

type NavigationProp = DrawerNavigationProp<RouteParamList>;
type AppViewerRouteProp = RouteProp<RouteParamList, 'AppViewer'>;

function AppViewerScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AppViewerRouteProp>();
  const { app } = route.params;
  const { colors, isDark } = useTheme();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors, isFullScreen);

  // Enable immersive mode only when entering fullscreen
  useEffect(() => {
    if (Platform.OS === 'android' && NavigationBarModule) {
      if (isFullScreen) {
        NavigationBarModule.setImmersiveMode(true);
      } else {
        NavigationBarModule.resetToDefault();
      }
    }
  }, [isFullScreen]);

  const handleLoadEnd = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation, isDark),
    [navigation, isDark]
  );

  const headerRight = useCallback(
    () => (
      <TouchableOpacity
        style={styles.fullScreenButton}
        onPress={() => setIsFullScreen(true)}>
        <Text style={styles.fullScreenIcon}>⛶</Text>
      </TouchableOpacity>
    ),
    [styles]
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft,
      headerRight,
      headerShown: !isFullScreen,
    });
  }, [navigation, headerLeft, headerRight, isFullScreen]);

  return (
    <View style={styles.container}>
      {isFullScreen && (
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />
      )}
      <Animated.View style={[styles.webView, { opacity: fadeAnim }]}>
        <AIWebView
          html={app.htmlCode}
          baseUrl={`https://app-${app.id}.local/`}
          style={styles.webView}
          scrollEnabled={true}
          bounces={false}
          onLoadEnd={handleLoadEnd}
        />
      </Animated.View>
      {isFullScreen && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setIsFullScreen(false)}>
          <Text style={styles.closeButtonX}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: ColorScheme, isFullScreen: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      ...(isFullScreen && {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }),
    },
    webView: {
      flex: 1,
      backgroundColor: '#000000',
    },
    fullScreenButton: {
      padding: 2,
      marginTop: 4,
    },
    fullScreenIcon: {
      fontSize: 24,
      color: colors.text,
    },
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 20) + 20,
      left: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(50, 50, 50, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    closeButtonX: {
      fontSize: 20,
      fontWeight: '400',
      marginBottom: -2,
      color: '#ffffff',
      lineHeight: 20,
    },
  });

export default AppViewerScreen;
