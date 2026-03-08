import React, { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Image,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteParamList } from '../types/RouteTypes';
import { useTheme, ColorScheme } from '../theme';
import RNFS from 'react-native-fs';
import { ChatMode } from '../types/Chat';
import ImageView from 'react-native-image-viewing';
import { ImageSource } from 'react-native-image-viewing/dist/@types';
import Share from 'react-native-share';
import { showInfo } from '../chat/util/ToastUtils';
import { isMacCatalyst } from '../utils/PlatformUtils';
import FileViewer from 'react-native-file-viewer';
import { CustomHeaderRightButton } from '../chat/component/CustomHeaderRightButton';

type NavigationProp = NativeStackNavigationProp<RouteParamList>;

export interface ImageItem {
  id: string;
  path: string;
  name: string;
  createdAt: number;
}

const getNumColumns = (width: number) => (width > 434 ? 5 : 3);

function ImageGalleryScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get('window').width
  );
  const numColumns = getNumColumns(screenWidth);
  const styles = createStyles(colors, numColumns);

  // ImageView state
  const [visible, setIsVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<ImageSource[]>([]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const documentsDir = RNFS.DocumentDirectoryPath;
      const files = await RNFS.readDir(documentsDir);

      const imageFiles = files
        .filter(
          file => file.name.startsWith('image_') && file.name.endsWith('.png')
        )
        .map(file => {
          const timestamp = parseInt(
            file.name.replace('image_', '').replace('.png', ''),
            10
          );
          return {
            id: file.name,
            path: Platform.OS === 'ios' ? file.path : `file://${file.path}`,
            name: file.name,
            createdAt: isNaN(timestamp)
              ? file.mtime?.getTime() || 0
              : timestamp,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      setImages(imageFiles);
      setImageUrls(imageFiles.map(img => ({ uri: img.path })));
    } catch (error) {
      console.log('Error loading images:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadImages();
    }, [loadImages])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={() => {
            navigation.navigate('Bedrock', {
              sessionId: -1,
              tapIndex: -2,
              mode: ChatMode.Image,
            });
          }}
          imageSource={
            isDark
              ? require('../assets/add_dark.png')
              : require('../assets/add.png')
          }
        />
      ),
      title: 'Image Gallery',
    });
  }, [navigation, isDark]);

  const handleDeleteImage = useCallback(
    (image: ImageItem) => {
      Alert.alert(
        'Delete Image',
        'Are you sure you want to delete this image?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const fullPath =
                  Platform.OS === 'ios'
                    ? `${RNFS.DocumentDirectoryPath}/${image.name}`
                    : image.path.replace('file://', '');
                const exists = await RNFS.exists(fullPath);
                if (exists) {
                  await RNFS.unlink(fullPath);
                }
                loadImages();
              } catch (error) {
                console.log('Error deleting image:', error);
              }
            },
          },
        ]
      );
    },
    [loadImages]
  );

  const handleSaveOrShare = useCallback(async (image: ImageItem) => {
    try {
      let filePath =
        Platform.OS === 'ios'
          ? `${RNFS.DocumentDirectoryPath}/${image.name}`
          : image.path;

      if (isMacCatalyst) {
        // On Mac, save to Downloads folder
        const downloadsPath = RNFS.DocumentDirectoryPath.replace(
          '/Documents',
          '/Downloads'
        );
        const destPath = `${downloadsPath}/${image.name}`;
        await RNFS.copyFile(filePath, destPath);
        Alert.alert(
          'Success',
          `Image saved to Downloads folder:\n${image.name}`
        );
      } else {
        // On mobile, use share sheet
        if (Platform.OS === 'android') {
          filePath = image.path;
        }
        const shareOptions = {
          url: filePath,
          type: 'image/png',
          title: 'Save Image',
        };
        await Share.open(shareOptions);
      }
    } catch (error) {
      console.log('Error saving/sharing image:', error);
      // User cancelled share is not an error
      if ((error as Error).message !== 'User did not share') {
        showInfo('Action cancelled');
      }
    }
  }, []);

  const handleOpenImage = useCallback((image: ImageItem, index: number) => {
    if (isMacCatalyst) {
      // On Mac, use system file viewer
      FileViewer.open(image.path).catch(error => {
        console.log('Error opening file:', error);
      });
    } else {
      // On iOS/Android, use ImageView with swipe support
      setViewerIndex(index);
      setIsVisible(true);
    }
  }, []);

  const renderImageItem = useCallback(
    ({ item, index }: { item: ImageItem; index: number }) => {
      return (
        <View style={styles.imageCard}>
          <TouchableOpacity
            style={styles.imageCardInner}
            onPress={() => handleOpenImage(item, index)}
            onLongPress={() => handleDeleteImage(item)}
            activeOpacity={0.7}>
            <Image
              source={{ uri: item.path }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      );
    },
    [styles, handleOpenImage, handleDeleteImage]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No generated images yet</Text>
        <Text style={styles.emptySubtext}>
          Generate images in chat and they will appear here
        </Text>
      </View>
    ),
    [styles]
  );

  const HeaderComponent = useCallback(
    () => (
      <SafeAreaProvider>
        <SafeAreaView style={headerStyles.root} edges={['top']}>
          <TouchableOpacity
            style={headerStyles.closeButton}
            onPress={() => setIsVisible(false)}
            hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}>
            <Text style={headerStyles.closeText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    ),
    []
  );

  const FooterComponent = useCallback(
    ({ imageIndex }: { imageIndex: number }) => {
      const currentImage = images[imageIndex];
      if (!currentImage) {
        return null;
      }

      return (
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => handleSaveOrShare(currentImage)}>
            <Image
              source={require('../assets/download.png')}
              style={styles.footerIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => {
              setIsVisible(false);
              setTimeout(() => handleDeleteImage(currentImage), 300);
            }}>
            <Image
              source={require('../assets/delete.png')}
              style={styles.footerIcon}
            />
          </TouchableOpacity>
        </View>
      );
    },
    [images, handleSaveOrShare, handleDeleteImage, styles]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        key={`flatlist-${numColumns}`}
        data={images}
        renderItem={renderImageItem}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={
          images.length > 1 ? styles.columnWrapper : undefined
        }
        ListEmptyComponent={renderEmptyState}
      />
      <ImageView
        images={imageUrls}
        imageIndex={viewerIndex}
        visible={visible}
        onRequestClose={() => setIsVisible(false)}
        HeaderComponent={HeaderComponent}
        FooterComponent={FooterComponent}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme, numColumns: number) => {
  // 均分宽度，间距通过 paddingLeft/paddingRight 实现
  const cardWidthPercent = numColumns === 5 ? '20%' : '33.333%';

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContainer: {
      paddingTop: 12,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
      flexGrow: 1,
    },
    columnWrapper: {
      justifyContent: 'flex-start',
    },
    imageCard: {
      width: cardWidthPercent,
      paddingLeft: 4,
      paddingRight: 4,
      marginBottom: 8,
    },
    imageCardInner: {
      aspectRatio: 1,
      backgroundColor: colors.card,
      borderRadius: 8,
      overflow: 'hidden',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 40,
      gap: 32,
    },
    footerButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerIcon: {
      width: 24,
      height: 24,
      tintColor: '#ffffff',
    },
  });
};

const headerStyles = StyleSheet.create({
  root: {
    alignItems: 'flex-end',
  },
  closeButton: {
    marginRight: 8,
    marginTop: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#00000077',
  },
  closeText: {
    lineHeight: 22,
    fontSize: 19,
    textAlign: 'center',
    color: '#FFF',
  },
});

export default ImageGalleryScreen;
