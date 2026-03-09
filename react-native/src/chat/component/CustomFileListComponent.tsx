import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { FileInfo, FileType } from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import ImageView from 'react-native-image-viewing';
import { ImageSource } from 'react-native-image-viewing/dist/@types';
import Share from 'react-native-share';
import FileViewer from 'react-native-file-viewer';
import { isMac } from '../../App.tsx';
import { getFullFileUrl, saveFile } from '../util/FileUtils.ts';
import { getVideoMetaData, Video } from 'react-native-compressor';
import * as Progress from 'react-native-progress';
import { showInfo } from '../util/ToastUtils.ts';
import { ColorScheme, useTheme } from '../../theme';

interface CustomFileProps {
  files: FileInfo[];
  onFileUpdated?: (files: FileInfo[], isUpdate?: boolean) => void;
  mode?: DisplayMode;
  isHideFileList?: boolean;
}

export enum DisplayMode {
  Edit = 'edit',
  Display = 'display',
  GenImage = 'genImage',
}

const MAX_VIDEO_SIZE = 8;

const openInFileViewer = (url: string) => {
  FileViewer.open(url)
    .then(() => {})
    .catch(error => {
      console.log(error);
    });
};

const CircularProgress = ({
  progress,
  colors,
}: {
  progress: number;
  colors: ColorScheme;
}) => {
  const styles = getStyles(colors);
  return (
    <View style={styles.progressContainer}>
      <Progress.Pie
        size={32}
        color="rgba(180, 180, 180, 1)"
        borderColor="rgba(180, 180, 180, 1)"
        progress={progress}
      />
    </View>
  );
};

export const CustomFileListComponent: React.FC<CustomFileProps> = ({
  files,
  onFileUpdated,
  mode = DisplayMode.Edit,
  isHideFileList = false,
}) => {
  const { colors, isDark } = useTheme();
  const [visible, setIsVisible] = useState(false);
  const [index, setIndex] = useState<number>(0);
  const [imageUrls, setImageUrls] = useState<ImageSource[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const compressingFiles = useRef<string>('');
  const filesRef = useRef(files);
  const isCompressing = useRef(false);

  useEffect(() => {
    filesRef.current = files;
    if (scrollViewRef.current && mode !== DisplayMode.Display) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [files, mode]);

  const renderImageHeader = useCallback(
    () => (
      <SafeAreaProvider>
        <SafeAreaView style={imageHeaderStyles.root} edges={['top']}>
          <TouchableOpacity
            style={imageHeaderStyles.closeButton}
            onPress={() => setIsVisible(false)}
            hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}>
            <Text style={imageHeaderStyles.closeText}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    ),
    [],
  );

  const handleCompression = useCallback(async () => {
    for (const file of filesRef.current) {
      if (
        !isCompressing.current &&
        file.type === FileType.video &&
        !file.videoUrl &&
        compressingFiles.current !== file.url
      ) {
        compressingFiles.current = file.url;
        try {
          isCompressing.current = true;
          const uri = await Video.compress(
            file.url,
            { progressDivider: 1, maxSize: 960 },
            progress => {
              setCompressionProgress(progress);
            }
          );
          const metaData = await getVideoMetaData(uri);
          isCompressing.current = false;
          compressingFiles.current = '';
          const currentSize = metaData.size / 1024 / 1024;
          if (currentSize < MAX_VIDEO_SIZE) {
            // save video to files and update video url
            const localFileUrl = await saveFile(
              uri,
              file.fileName + '.' + metaData.extension
            );
            if (localFileUrl) {
              const updatedFiles = filesRef.current.map(f =>
                f.url === file.url
                  ? { ...f, videoUrl: localFileUrl, format: metaData.extension }
                  : f
              );
              onFileUpdated!(updatedFiles, true);
            }
          } else {
            // remove the video
            const newFiles = filesRef.current.filter(f => f.url !== file.url);
            onFileUpdated!(newFiles, true);
            showInfo(
              `Video too large: ${currentSize.toFixed(
                1
              )}MB (max ${MAX_VIDEO_SIZE}MB)`
            );
          }
        } catch (error) {
          showInfo('Video process failed');
          compressingFiles.current = '';
          isCompressing.current = false;
          // remove the failed video
          const newFiles = filesRef.current.filter(f => f.url !== file.url);
          onFileUpdated!(newFiles, true);
        }
      }
    }
  }, [onFileUpdated]);

  useEffect(() => {
    const checkAndCompressVideos = async () => {
      await handleCompression();
    };
    checkAndCompressVideos().then();
  }, [files, handleCompression]);

  const renderFileItem = (file: FileInfo, fileIndex: number) => {
    const isImage = file.type === FileType.image;
    const isDocument = file.type === FileType.document;
    const isVideo = file.type === FileType.video;
    const fullFileUrl =
      isVideo && !file.videoUrl
        ? file.url
        : getFullFileUrl(file.videoUrl || file.url);
    const itemKey = `file-${fileIndex}-${file.url}`;

    const isFileCompressing = compressingFiles.current === file.url;
    let ratio = 1;
    if (file.width && file.height) {
      ratio = file.width / file.height;
      ratio = ratio < 1 ? 1 : ratio;
    }
    const isHideDelete = file.type === FileType.video && !file.videoUrl;
    const isShowDelete =
      mode === DisplayMode.GenImage ||
      (mode === DisplayMode.Edit && !isHideDelete);
    return (
      <View
        key={itemKey}
        style={{
          ...styles.fileItem,
          ...(isDocument && {
            width: 158,
          }),
          ...(isVideo && {
            width: 72 * ratio,
          }),
        }}>
        {isShowDelete && (
          <TouchableOpacity
            style={styles.deleteTouchable}
            onPress={() => {
              const newFiles = files.filter(f => f.url !== file.url);
              onFileUpdated!(newFiles, true);
            }}>
            <View style={styles.deleteLayout}>
              <Text style={styles.deleteText}>×</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onLongPress={() => {
            try {
              const options = {
                type: 'text/plain',
                url: fullFileUrl,
                showAppsToView: true,
              };
              Share.open(options).then();
            } catch (error) {
              console.log('Error opening file:', error);
            }
          }}
          onPress={() => {
            if (isVideo && isFileCompressing) {
              return;
            }
            if (
              isMac ||
              mode === DisplayMode.GenImage ||
              file.type === FileType.document ||
              file.type === FileType.video
            ) {
              openInFileViewer(fullFileUrl);
            } else {
              const images = files
                .filter(item => item.type === FileType.image)
                .map(item => ({ uri: getFullFileUrl(item.url) }));
              const currentIndex = images.findIndex(
                img => img.uri === fullFileUrl
              );
              setImageUrls(images);
              setIndex(currentIndex);
              setIsVisible(true);
            }
          }}>
          {isImage || isVideo ? (
            <View style={styles.thumbnailContainer}>
              <Image
                source={{
                  uri: isVideo
                    ? getFullFileUrl(file.videoThumbnailUrl!)
                    : fullFileUrl,
                }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              {isVideo && !isFileCompressing && (
                <Image
                  source={require('../../assets/play.png')}
                  style={styles.playIcon}
                />
              )}
              {isVideo && isFileCompressing && (
                <CircularProgress
                  progress={compressionProgress}
                  colors={colors}
                />
              )}
            </View>
          ) : (
            <View style={styles.filePreview}>
              <Text numberOfLines={2} style={styles.fileName}>
                {file.fileName}
              </Text>
              <View style={styles.formatContainer}>
                <Image
                  source={
                    isDark
                      ? require('./../../assets/document_dark.png')
                      : require('./../../assets/document.png')
                  }
                  style={styles.formatIcon}
                />
                <Text style={styles.fileFormat}>
                  {file.format.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const styles = getStyles(colors);

  return (
    <ScrollView
      horizontal
      ref={scrollViewRef}
      contentContainerStyle={{
        ...styles.containerStyle,
        ...(mode === DisplayMode.Display && {
          paddingHorizontal: 0,
          width: files.length > 2 ? undefined : '100%',
          justifyContent: 'flex-end',
        }),
      }}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={{
        ...styles.scrollView,
        ...(mode === DisplayMode.Display && {
          marginLeft: 0,
          paddingTop: 4,
        }),
        // allow adding files by command+v after input texts
        ...(files.length === 0 &&
          isHideFileList && {
            opacity: 0,
            position: 'absolute',
            height: 0,
            overflow: 'hidden',
          }),
      }}>
      {files.map((file, fileIndex) => renderFileItem(file, fileIndex))}

      {mode === DisplayMode.Edit && (
        <TouchableOpacity key="add-button" style={styles.addButton}>
          <CustomAddFileComponent onFileSelected={onFileUpdated!} mode="list" />
        </TouchableOpacity>
      )}
      <ImageView
        images={imageUrls}
        imageIndex={index}
        visible={visible}
        onRequestClose={() => setIsVisible(false)}
        HeaderComponent={renderImageHeader}
      />
    </ScrollView>
  );
};

const getStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    scrollView: {
      paddingVertical: 8,
      backgroundColor: colors.fileListBackground,
    },
    containerStyle: {
      paddingHorizontal: 12,
    },
    fileItem: {
      width: 72,
      height: 72,
      marginRight: 8,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    deleteTouchable: {
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLayout: {
      width: 20,
      height: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      color: '#fff',
      fontSize: 16,
      marginTop: -1.5,
      marginRight: -0.5,
      fontWeight: 'normal',
    },
    thumbnailContainer: {
      position: 'relative',
      width: '100%',
      height: '100%',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    playIcon: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -16,
      marginLeft: -16,
      width: 32,
      height: 32,
    },
    filePreview: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.fileItemBorder,
      borderRadius: 8,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: 8,
    },
    formatContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    formatIcon: {
      width: 16,
      height: 16,
      marginRight: 4,
    },
    fileName: {
      fontSize: 12,
      color: colors.text,
      paddingRight: 12,
    },
    fileFormat: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    addButton: {
      width: 72,
      height: 72,
      backgroundColor: colors.addButtonBackground,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -16,
      marginLeft: -16,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const imageHeaderStyles = StyleSheet.create({
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
