import React, { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../../history/AppProvider';
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
import { Model, ModelTag } from '../../../types/Chat';
import {
  getTextModel,
  saveTextModel,
  updateTextModelUsageOrder,
  getMergedModelOrder,
} from '../../../storage/StorageUtils';
import { useTheme, ColorScheme } from '../../../theme';
import { getModelIcon } from '../../../utils/ModelUtils.ts';
import { liteRTService } from '../../service/LiteRTService.ts';

interface ModelSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  iconPosition?: { x: number; y: number };
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_HEIGHT = 360;

export const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
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
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model>(getTextModel());
  const [downloading, setDownloading] = useState(liteRTService.downloading);
  const [downloadProgress, setDownloadProgress] = useState(liteRTService.downloadProgress);
  const [downloadSpeed, setDownloadSpeed] = useState(liteRTService.downloadSpeedText);

  // Animation values
  const translateX = useSharedValue(100);
  const translateY = useSharedValue(100);
  const scale = useSharedValue(0.5);

  const startOpenAnimation = useCallback(() => {
    // Animate from icon position to modal position
    translateX.value = -4;
    translateY.value = 0;
    scale.value = 0;

    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(-MODAL_HEIGHT, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      loadModels();
      startOpenAnimation();
      if (liteRTService.downloading) {
        setDownloading(true);
        setDownloadProgress(liteRTService.downloadProgress);
        setDownloadSpeed(liteRTService.downloadSpeedText);
        liteRTService.setDownloadCallbacks(
          (progress, speed) => {
            setDownloadProgress(progress);
            setDownloadSpeed(speed);
          },
          () => {
            setDownloading(false);
          },
          () => {
            setDownloading(false);
          }
        );
      }
    }
  }, [startOpenAnimation, visible]);

  const loadModels = () => {
    // Get merged models (combines history with current available models)
    const mergedModels = getMergedModelOrder();
    setModels(mergedModels);
    setSelectedModel(getTextModel());
  };

  const startCloseAnimation = (callback: () => void) => {
    // Animate back to icon position
    translateX.value = withTiming(-4, { duration: 250 });
    translateY.value = withTiming(0, { duration: 250 }); // Changed from -20 to -150
    scale.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const handleClose = () => {
    startCloseAnimation(onClose);
  };

  const selectModel = (model: Model) => {
    setSelectedModel(model);
    saveTextModel(model);
    updateTextModelUsageOrder(model);
    sendEvent('modelChanged');

    if (model.modelTag === ModelTag.LiteRT) {
      liteRTService.initialize();
    }

    const mergedModels = getMergedModelOrder();
    setModels(mergedModels);

    startCloseAnimation(() => {
      onClose();
    });
  };

  const startDownload = (model: Model) => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadSpeed('');

    liteRTService.setDownloadCallbacks(
      (progress, speed) => {
        setDownloadProgress(progress);
        setDownloadSpeed(speed);
      },
      () => {
        setDownloading(false);
        selectModel(model);
      },
      () => {
        setDownloading(false);
      }
    );

    liteRTService.startDownload();
  };

  const cancelDownload = () => {
    liteRTService.cancelDownload();
    setDownloading(false);
    setDownloadProgress(0);
    setDownloadSpeed('');
  };

  const handleModelSelect = (model: Model) => {
    if (model.modelTag === ModelTag.LiteRT) {
      startDownload(model);
      return;
    }
    selectModel(model);
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

  const renderModelItem = ({ item, index }: { item: Model; index: number }) => {
    const isSelected = selectedModel.modelId === item.modelId;
    const isLastItem = index === models.length - 1;

    return (
      <TouchableOpacity
        // eslint-disable-next-line react-native/no-inline-styles
        style={[styles.modelItem, isLastItem && { borderBottomWidth: 0 }]}
        onPress={() => handleModelSelect(item)}>
        <View style={styles.modelItemContent}>
          <Image
            source={getModelIcon(item.modelTag ?? '', item.modelId, isDark)}
            style={styles.modelIcon}
          />
          <Text style={styles.modelName}>{item.modelName}</Text>
          {isSelected && (
            <Image
              source={
                isDark
                  ? require('../../../assets/done_dark.png')
                  : require('../../../assets/done.png')
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
                animatedStyle,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  position: 'absolute',
                  right: 10,
                  top: Math.max(iconPosition.y - 10, 10),
                  transformOrigin: 'right top',
                },
              ]}>
              <View style={styles.header}>
                <Text style={styles.title}>Select Model</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={8}
                  style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              {downloading ? (
                <View style={styles.downloadContainer}>
                  <Text style={styles.downloadTitle}>Downloading Gemma 4 E2B</Text>
                  <Text style={styles.downloadSize}>2.59 GB</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round(downloadProgress * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.downloadPercent}>
                    {Math.round(downloadProgress * 100)}%{downloadSpeed ? `  •  ${downloadSpeed}` : ''}
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelDownload}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={models}
                  renderItem={renderModelItem}
                  keyExtractor={item => item.modelId}
                  style={styles.modelList}
                />
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
      width: 240,
      height: MODAL_HEIGHT,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
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
    modelList: {
      paddingRight: 8,
    },
    modelItem: {
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderLight,
    },
    modelItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 2,
    },
    modelIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
    },
    modelName: {
      fontSize: 14,
      flex: 1,
      color: colors.text,
    },
    checkIcon: {
      width: 16,
      height: 16,
    },
    downloadContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    downloadTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    downloadSize: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    progressBarBg: {
      width: '100%',
      height: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    downloadPercent: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
    },
    cancelButton: {
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cancelButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
