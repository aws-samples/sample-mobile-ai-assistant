import React, { useCallback, useState, useEffect, useRef } from 'react';
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
  Modal,
  TextInput,
  GestureResponderEvent,
  Animated,
  Easing,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes';
import {
  getSavedApps,
  deleteApp,
  getAppById,
  AppMetadata,
  pinApp,
  renameApp,
} from '../storage/StorageUtils';
import { CustomHeaderRightButton } from '../chat/component/CustomHeaderRightButton';
import { useTheme, ColorScheme } from '../theme';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';
import { showInfo } from '../chat/util/ToastUtils';
import { isMac } from '../App';
import Share from 'react-native-share';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

const getNumColumns = (width: number) => (width > 450 ? 4 : 2);
const MENU_HEIGHT = 336; // 6 items * 56px each

// Context menu item
interface MenuItemProps {
  label: string;
  icon: ImageSourcePropType;
  onPress: () => void;
  isDestructive?: boolean;
  rotateIcon?: boolean;
  colors: ColorScheme;
  isLast?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  label,
  icon,
  onPress,
  isDestructive,
  rotateIcon,
  colors,
  isLast,
}) => {
  const styles = menuStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={onPress}>
      <Text
        style={[styles.menuLabel, isDestructive && styles.destructiveLabel]}>
        {label}
      </Text>
      <Image
        source={icon}
        style={[
          styles.menuIcon,
          isDestructive && styles.destructiveIcon,
          rotateIcon && styles.rotatedIcon,
        ]}
      />
    </TouchableOpacity>
  );
};

const menuStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuLabel: {
      fontSize: 17,
      color: colors.text,
    },
    destructiveLabel: {
      color: '#FF3B30',
    },
    menuIcon: {
      width: 20,
      height: 20,
      tintColor: colors.text,
    },
    destructiveIcon: {
      tintColor: '#FF3B30',
    },
    rotatedIcon: {
      transform: [{ rotate: '180deg' }],
    },
  });

// Animated menu component
interface AnimatedMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  expandUp: boolean;
  onClose: () => void;
  children: React.ReactNode;
  colors: ColorScheme;
}

const AnimatedMenu: React.FC<AnimatedMenuProps> = ({
  visible,
  position,
  expandUp,
  onClose,
  children,
  colors,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const screenW = Dimensions.get('window').width;
  const menuWidth = 200;
  let left = position.x - menuWidth / 2;

  if (left < 16) {
    left = 16;
  }
  if (left + menuWidth > screenW - 16) {
    left = screenW - menuWidth - 16;
  }

  const menuContainerStyle = {
    position: 'absolute' as const,
    top: position.y,
    left: left,
    width: menuWidth,
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    opacity: opacityAnim,
    transform: [{ scaleY: scaleAnim }],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={animatedMenuStyles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <Animated.View
          style={[
            menuContainerStyle,
            expandUp
              ? animatedMenuStyles.transformOriginBottom
              : animatedMenuStyles.transformOriginTop,
          ]}>
          {children}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const animatedMenuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  transformOriginBottom: {
    transformOrigin: 'bottom',
  },
  transformOriginTop: {
    transformOrigin: 'top',
  },
});

function AppGalleryScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const [apps, setApps] = useState<AppMetadata[]>([]);
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get('window').width
  );
  const numColumns = getNumColumns(screenWidth);
  const styles = createStyles(colors, numColumns);

  // Context menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuExpandUp, setMenuExpandUp] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppMetadata | null>(null);

  // Rename modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  // Listen for screen size changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const loadApps = useCallback(() => {
    const savedApps = getSavedApps();
    setApps(savedApps);
  }, []);

  // Reload apps when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const savedApps = getSavedApps();
      setApps(savedApps);
    }, [])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={() => navigation.navigate('CreateApp', {})}
          imageSource={
            isDark
              ? require('../assets/add_dark.png')
              : require('../assets/add.png')
          }
        />
      ),
      title: 'App Gallery',
    });
  }, [navigation, isDark]);

  const handleLongPress = useCallback(
    (app: AppMetadata, event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      const screenHeight = Dimensions.get('window').height;

      // Determine if menu should expand up or down
      const spaceBelow = screenHeight - pageY;
      const shouldExpandUp = spaceBelow < MENU_HEIGHT + 50;

      let adjustedY = pageY;
      if (shouldExpandUp) {
        // Position menu above finger, menu will expand upward
        adjustedY = pageY - MENU_HEIGHT;
        if (adjustedY < 50) {
          adjustedY = 50;
        }
      } else {
        // Menu expands downward from finger position
        if (pageY + MENU_HEIGHT > screenHeight - 50) {
          adjustedY = screenHeight - MENU_HEIGHT - 50;
        }
      }

      setMenuPosition({ x: pageX, y: adjustedY });
      setMenuExpandUp(shouldExpandUp);
      setSelectedApp(app);
      setMenuVisible(true);
    },
    []
  );

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setSelectedApp(null);
  }, []);

  const handleRename = useCallback(() => {
    if (selectedApp) {
      setNewName(selectedApp.name);
      setMenuVisible(false);
      setRenameModalVisible(true);
    }
  }, [selectedApp]);

  const confirmRename = useCallback(() => {
    if (selectedApp && newName.trim()) {
      renameApp(selectedApp.id, newName.trim());
      loadApps();
    }
    setRenameModalVisible(false);
    setSelectedApp(null);
    setNewName('');
  }, [selectedApp, newName, loadApps]);

  const handlePin = useCallback(() => {
    if (selectedApp) {
      pinApp(selectedApp.id);
      loadApps();
    }
    closeMenu();
  }, [selectedApp, loadApps, closeMenu]);

  const handleCopy = useCallback(() => {
    if (selectedApp) {
      const app = getAppById(selectedApp.id);
      if (app) {
        Clipboard.setString(app.htmlCode);
        showInfo('Code copied');
      }
    }
    closeMenu();
  }, [selectedApp, closeMenu]);

  const handleEdit = useCallback(() => {
    if (selectedApp) {
      const app = getAppById(selectedApp.id);
      if (app) {
        closeMenu();
        navigation.navigate('Bedrock', {
          editAppCode: app.htmlCode,
          editAppName: app.name,
          editTimestamp: Date.now(),
        });
      }
    }
  }, [selectedApp, closeMenu, navigation]);

  const handleSaveToFile = useCallback(async () => {
    if (selectedApp) {
      const app = getAppById(selectedApp.id);
      if (app) {
        try {
          const fileName = `${app.name.replace(
            /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
            '_'
          )}.html`;

          if (isMac) {
            // On Mac, save directly to Downloads folder
            const downloadsPath = RNFS.DocumentDirectoryPath.replace(
              '/Documents',
              '/Downloads'
            );
            const filePath = `${downloadsPath}/${fileName}`;
            await RNFS.writeFile(filePath, app.htmlCode, 'utf8');
            showInfo('Saved to Downloads');
          } else if (Platform.OS === 'android') {
            // On Android, save to Downloads folder
            const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, app.htmlCode, 'utf8');
            showInfo('Saved to Downloads');
          } else {
            // On iOS mobile, save to Documents then use Share sheet
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, app.htmlCode, 'utf8');
            const shareOptions = {
              url: filePath,
              type: 'text/html',
              title: 'Save HTML File',
            };
            await Share.open(shareOptions);
          }
        } catch (error) {
          console.log('Error saving file:', error);
          // User cancelled share is not an error
          if ((error as Error).message !== 'User did not share') {
            Alert.alert('Error', 'Failed to save file');
          }
        }
      }
    }
    closeMenu();
  }, [selectedApp, closeMenu]);

  const handleDelete = useCallback(() => {
    if (selectedApp) {
      const app = selectedApp;
      closeMenu();
      Alert.alert(
        'Delete App',
        `Are you sure you want to delete "${app.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (app.screenshotPath) {
                try {
                  const fullPath =
                    Platform.OS === 'ios'
                      ? `${RNFS.DocumentDirectoryPath}/${app.screenshotPath}`
                      : app.screenshotPath.replace('file://', '');
                  const exists = await RNFS.exists(fullPath);
                  if (exists) {
                    await RNFS.unlink(fullPath);
                  }
                } catch (error) {
                  console.log('Error deleting screenshot:', error);
                }
              }
              deleteApp(app.id);
              loadApps();
            },
          },
        ]
      );
    }
  }, [selectedApp, closeMenu, loadApps]);

  const handleOpenApp = useCallback(
    (appMetadata: AppMetadata) => {
      const app = getAppById(appMetadata.id);
      if (app) {
        navigation.navigate('AppViewer', { app });
      }
    },
    [navigation]
  );

  const renderAppItem = useCallback(
    ({ item }: { item: AppMetadata }) => {
      const screenshotUri = item.screenshotPath
        ? Platform.OS === 'ios'
          ? `${RNFS.DocumentDirectoryPath}/${item.screenshotPath}`
          : item.screenshotPath
        : null;
      return (
        <View style={styles.appCard}>
          <TouchableOpacity
            style={styles.appCardInner}
            onPress={() => handleOpenApp(item)}
            onLongPress={e => handleLongPress(item, e)}
            activeOpacity={0.7}>
            <View style={styles.screenshotContainer}>
              {screenshotUri ? (
                <Image
                  source={{ uri: screenshotUri }}
                  style={styles.screenshot}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Text style={styles.placeholderText}>No Preview</Text>
                </View>
              )}
            </View>
            <View style={styles.appInfo}>
              <Text style={styles.appName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.appDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [styles, handleOpenApp, handleLongPress]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No saved apps yet</Text>
        <Text style={styles.emptySubtext}>
          Generate HTML apps in chat and save them here
        </Text>
      </View>
    ),
    [styles]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        key={`flatlist-${numColumns}`}
        data={apps}
        renderItem={renderAppItem}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={apps.length > 1 ? styles.columnWrapper : undefined}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Context Menu */}
      <AnimatedMenu
        visible={menuVisible}
        position={menuPosition}
        expandUp={menuExpandUp}
        onClose={closeMenu}
        colors={colors}>
        <MenuItem
          label="Edit"
          icon={require('../assets/edit.png')}
          onPress={handleEdit}
          colors={colors}
        />
        <MenuItem
          label="Rename"
          icon={require('../assets/rename.png')}
          onPress={handleRename}
          colors={colors}
        />
        <MenuItem
          label="Pin to Top"
          icon={require('../assets/scroll_down.png')}
          onPress={handlePin}
          rotateIcon
          colors={colors}
        />
        <MenuItem
          label="Copy Code"
          icon={require('../assets/copy.png')}
          onPress={handleCopy}
          colors={colors}
        />
        <MenuItem
          label={isMac ? 'Download' : 'Share'}
          icon={
            isMac
              ? require('../assets/download.png')
              : require('../assets/share.png')
          }
          onPress={handleSaveToFile}
          colors={colors}
        />
        <MenuItem
          label="Delete"
          icon={require('../assets/delete.png')}
          onPress={handleDelete}
          isDestructive
          colors={colors}
          isLast
        />
      </AnimatedMenu>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setRenameModalVisible(false)}>
          <View
            style={styles.renameModalContent}
            onStartShouldSetResponder={() => true}>
            <Text style={styles.renameTitle}>Rename App</Text>
            <TextInput
              style={styles.renameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="App name"
              placeholderTextColor={colors.placeholder}
              maxLength={20}
              autoFocus
            />
            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={styles.renameCancelButton}
                onPress={() => {
                  setRenameModalVisible(false);
                  setSelectedApp(null);
                  setNewName('');
                }}>
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameConfirmButton}
                onPress={confirmRename}>
                <Text style={styles.renameConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme, numColumns: number) => {
  // 均分宽度，间距通过 paddingLeft 实现
  const cardWidthPercent = numColumns === 4 ? '25%' : '50%';

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContainer: {
      paddingTop: 12,
      paddingRight: 6,
      paddingBottom: 12,
      paddingLeft: 6,
      flexGrow: 1,
    },
    columnWrapper: {
      justifyContent: 'flex-start',
    },
    appCard: {
      width: cardWidthPercent,
      paddingLeft: 6,
      paddingRight: 6,
      marginBottom: 12,
    },
    appCardInner: {
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    screenshotContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.input,
    },
    screenshot: {
      width: '100%',
      height: '100%',
    },
    placeholderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    appInfo: {
      padding: 10,
    },
    appName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    appDate: {
      fontSize: 12,
      color: colors.textSecondary,
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
    // Menu overlay
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    // Rename modal styles
    renameModalContent: {
      position: 'absolute',
      top: '35%',
      left: 40,
      right: 40,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 20,
    },
    renameTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    renameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      marginBottom: 16,
    },
    renameButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    renameCancelButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.border,
      marginRight: 8,
    },
    renameCancelText: {
      color: colors.text,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '500',
    },
    renameConfirmButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    renameConfirmText: {
      color: '#ffffff',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '500',
    },
  });
};

export default AppGalleryScreen;
