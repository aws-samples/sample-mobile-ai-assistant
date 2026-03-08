import React, { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../history/AppProvider';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Dialog from 'react-native-dialog';
import { useTheme, ColorScheme } from '../../theme';
import { getSearchProviderIcon } from '../../utils/SearchIconUtils';
import {
  getSearchProvider,
  saveSearchProvider,
  getTavilyApiKey,
  isGoogleLoginDone,
  saveGoogleLoginDone,
} from '../../storage/StorageUtils';
import { SEARCH_PROVIDER_CONFIGS } from '../../websearch/constants/SearchProviderConstants';
import { SearchEngineOption } from '../../websearch/types';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RouteParamList } from '../../types/RouteTypes';
import { isAndroid } from '../../utils/PlatformUtils';
import { GoogleLoginModal } from '../../websearch/components/GoogleLoginModal';

interface WebSearchSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  iconPosition?: { x: number; y: number };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_HEIGHT = isAndroid ? 244 : 240;

export const WebSearchSelectionModal: React.FC<
  WebSearchSelectionModalProps
> = ({
  visible,
  onClose,
  iconPosition = {
    x: SCREEN_WIDTH - 50,
    y: 70,
  },
}) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const { sendEvent } = useAppContext();
  const navigation = useNavigation<NavigationProp<RouteParamList>>();
  const [selectedProvider, setSelectedProvider] = useState<SearchEngineOption>(
    getSearchProvider() as SearchEngineOption
  );
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showGoogleLogin, setShowGoogleLogin] = useState(false);

  const translateX = useSharedValue(100);
  const translateY = useSharedValue(100);
  const scale = useSharedValue(0.5);

  const startOpenAnimation = useCallback(() => {
    translateX.value = -4;
    translateY.value = 0;
    scale.value = 0;

    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(-MODAL_HEIGHT, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      setSelectedProvider(getSearchProvider() as SearchEngineOption);
      startOpenAnimation();
    }
  }, [startOpenAnimation, visible]);

  const startCloseAnimation = (callback: () => void) => {
    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(0, { duration: 250 });
    scale.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const handleClose = () => {
    startCloseAnimation(onClose);
  };

  const completeProviderSelect = (provider: SearchEngineOption) => {
    setSelectedProvider(provider);
    saveSearchProvider(provider);

    sendEvent('searchProviderChanged');
    sendEvent('unSelectSystemPrompt');

    startCloseAnimation(() => {
      onClose();
    });
  };

  const handleProviderSelect = (provider: SearchEngineOption) => {
    // Check if Tavily is selected and API key is not configured
    if (provider === 'tavily') {
      const tavilyApiKey = getTavilyApiKey();
      if (!tavilyApiKey || tavilyApiKey.trim() === '') {
        setShowApiKeyDialog(true);
        return;
      }
    }

    // Check if Google is selected for the first time
    if (provider === 'google' && !isGoogleLoginDone()) {
      setShowGoogleLogin(true);
      return;
    }

    completeProviderSelect(provider);
  };

  const handleGoogleLoginDone = () => {
    saveGoogleLoginDone();
    setShowGoogleLogin(false);
    completeProviderSelect('google');
  };

  const handleGoogleLoginSkip = () => {
    setShowGoogleLogin(false);
    completeProviderSelect('google');
  };

  const handleGoToSettings = () => {
    setShowApiKeyDialog(false);
    startCloseAnimation(() => {
      onClose();
      // Navigate to Settings screen after modal closes
      setTimeout(() => {
        navigation.navigate('Settings', {});
      }, 300);
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const renderProviderItem = ({
    item,
    index,
  }: {
    item: (typeof SEARCH_PROVIDER_CONFIGS)[0];
    index: number;
  }) => {
    const isSelected = selectedProvider === item.id;
    const isLastItem = index === SEARCH_PROVIDER_CONFIGS.length - 1;

    return (
      <TouchableOpacity
        style={[styles.providerItem, isLastItem && styles.providerItemLastItem]}
        onPress={() => handleProviderSelect(item.id)}
        onLongPress={() => {
          if (item.id === 'google') {
            setShowGoogleLogin(true);
          }
        }}>
        <View style={styles.providerItemContent}>
          <Image
            source={getSearchProviderIcon(item.id, isDark)}
            style={styles.providerIcon}
          />
          <Text style={styles.providerName}>{item.name}</Text>
          {isSelected && (
            <Image
              source={
                isDark
                  ? require('../../assets/done_dark.png')
                  : require('../../assets/done.png')
              }
              style={styles.checkIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent={true}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                styles.modalContainerPositioned,
                animatedStyle,
                {
                  top: Math.max(iconPosition.y - 10, 10),
                },
              ]}>
              <View style={styles.header}>
                <Text style={styles.title}>Web Search</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={8}
                  style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={SEARCH_PROVIDER_CONFIGS}
                renderItem={renderProviderItem}
                keyExtractor={item => item.id}
                style={styles.providerList}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      <GoogleLoginModal
        visible={showGoogleLogin}
        onSkip={handleGoogleLoginSkip}
        onDone={handleGoogleLoginDone}
      />
      <Dialog.Container visible={showApiKeyDialog}>
        <Dialog.Title>Tavily API Key Required</Dialog.Title>
        <Dialog.Description>
          Please configure your Tavily API key in Settings before using Tavily
          search.
        </Dialog.Description>
        <Dialog.Button
          label="Cancel"
          onPress={() => setShowApiKeyDialog(false)}
        />
        <Dialog.Button label="Go to Settings" onPress={handleGoToSettings} />
      </Dialog.Container>
    </Modal>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      width: 200,
      height: MODAL_HEIGHT,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    modalContainerPositioned: {
      position: 'absolute',
      right: 10,
      transformOrigin: 'right top',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    closeButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      lineHeight: 18,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    providerList: {
      paddingRight: 8,
    },
    providerItem: {
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderLight,
    },
    providerItemLastItem: {
      borderBottomWidth: 0,
    },
    providerItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 2,
    },
    providerIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
    },
    providerName: {
      fontSize: 14,
      flex: 1,
      color: colors.text,
    },
    checkIcon: {
      width: 16,
      height: 16,
    },
  });
