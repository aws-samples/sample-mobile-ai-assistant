import {
  ActionSheetIOS,
  Image,
  Platform,
  StyleSheet,
  Text,
  NativeEventEmitter,
  NativeModules,
  TouchableOpacity,
} from 'react-native';
import React, { useRef, useEffect, useCallback } from 'react';
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { ChatMode, FileInfo, FileType } from '../../types/Chat.ts';
import {
  pick,
  types,
  DocumentPickerResponse,
} from 'react-native-document-picker';
import { saveFile } from '../util/FileUtils.ts';
import RNFS from 'react-native-fs';
import {
  createVideoThumbnail,
  getImageMetaData,
  getVideoMetaData,
  Image as Img,
} from 'react-native-compressor';
import { isMac } from '../../App.tsx';
import { getTextModel } from '../../storage/StorageUtils.ts';
import { showInfo } from '../util/ToastUtils.ts';
import { useTheme } from '../../theme';

const { FilePasteModule } = NativeModules;
const eventEmitter = FilePasteModule
  ? new NativeEventEmitter(FilePasteModule)
  : null;

interface CustomRenderActionsProps {
  onFileSelected: (files: FileInfo[]) => void;
  mode?: 'default' | 'list';
  chatMode?: ChatMode;
}

const DefaultIcon = () => {
  const { isDark } = useTheme();
  return (
    <Image
      style={styles.imageButton}
      resizeMode="contain"
      source={
        isDark
          ? require('../../assets/add_dark.png')
          : require('../../assets/add.png')
      }
    />
  );
};

const ListIcon = ({ textColor }: { textColor: string }) => (
  <Text style={[styles.addIcon, { color: textColor }]}>+</Text>
);

export const CustomAddFileComponent: React.FC<CustomRenderActionsProps> = ({
  onFileSelected,
  mode = 'default',
  chatMode = ChatMode.Text,
}) => {
  const { colors } = useTheme();
  const chatModeRef = useRef(chatMode);

  // Create a memoized ListIcon component with theme colors
  const ThemedListIcon = React.useCallback(
    () => <ListIcon textColor={colors.textSecondary} />,
    [colors.textSecondary]
  );
  chatModeRef.current = chatMode;

  // Process files from DocumentPickerResponse array
  const processFiles = useCallback(
    async (pickResults: DocumentPickerResponse[]): Promise<FileInfo[]> => {
      const files: FileInfo[] = [];
      await Promise.all(
        pickResults.map(async pickResult => {
          if (pickResult.name && pickResult.uri) {
            const fileName = getFileNameWithoutExtension(pickResult.name);
            const fileNameArr = pickResult.name.split('.');
            let format = fileNameArr[fileNameArr.length - 1].toLowerCase();
            const fileType = getFileType(format);
            if (fileType === FileType.unSupported) {
              const msg = 'Selected UnSupported Files format: .' + format;
              showInfo(msg);
              return;
            }
            if (
              fileType === FileType.document &&
              (pickResult.size ?? 0) >= MAX_FILE_SIZE
            ) {
              const msg = 'File size exceeds 4.5MB limit: ' + pickResult.name;
              showInfo(msg);
              return;
            }
            let localFileUrl: string | null;
            let width = 0;
            let height = 0;
            if (fileType === FileType.image) {
              pickResult.uri = decodeURI(pickResult.uri);
              if (format === 'png' || format === 'jpg' || format === 'jpeg') {
                pickResult.uri = await Img.compress(pickResult.uri);
                const metaData = await getImageMetaData(pickResult.uri);
                format = metaData.extension;
                width = metaData.ImageWidth;
                height = metaData.ImageHeight;
              }
              localFileUrl = await saveFile(pickResult.uri, pickResult.name);
            } else if (fileType === FileType.video) {
              localFileUrl = pickResult.uri;
            } else {
              localFileUrl = await saveFile(
                decodeURI(pickResult.uri),
                pickResult.name
              );
            }

            let thumbnailUrl;
            if (fileType === FileType.video) {
              if (Platform.OS === 'android') {
                localFileUrl = await saveFile(pickResult.uri, fileName);
                pickResult.uri = localFileUrl!;
              }
              const thumbnail = await createVideoThumbnail(pickResult.uri);
              thumbnailUrl =
                (await saveFile(thumbnail.path, fileName + '.jpeg')) ?? '';
              const metaData = await getVideoMetaData(pickResult.uri);
              width = metaData.width;
              height = metaData.height;
            }

            if (localFileUrl) {
              files.push({
                fileName: fileName,
                url: localFileUrl,
                videoThumbnailUrl: thumbnailUrl,
                fileSize: pickResult.size ?? 0,
                type: fileType,
                format: format.toLowerCase() === 'jpg' ? 'jpeg' : format,
                width: width,
                height: height,
              });
            }
          }
        }) ?? []
      );
      return files;
    },
    []
  );

  // Handle paste files from clipboard
  const handlePasteFiles = useCallback(async () => {
    try {
      const clipboardPath = `${RNFS.DocumentDirectoryPath}/clipboard`;

      // Check if clipboard directory exists
      const exists = await RNFS.exists(clipboardPath);
      if (!exists) {
        console.log('Clipboard directory does not exist');
        return;
      }

      // Read all files from clipboard directory
      const fileList = await RNFS.readDir(clipboardPath);

      if (fileList.length === 0) {
        console.log('No files found in clipboard directory');
        return;
      }

      // Convert to DocumentPickerResponse format
      const pickResults: DocumentPickerResponse[] = [];
      for (const file of fileList) {
        if (file.isFile()) {
          pickResults.push({
            uri: `file://${file.path}`,
            name: file.name,
            size: file.size,
            type: null, // Will be determined by file extension
            fileCopyUri: null,
          });
        }
      }

      // Process files using the shared logic
      const files = await processFiles(pickResults);

      if (files.length > 0) {
        onFileSelected(files);
      }
    } catch (error) {
      console.log('Error handling paste files:', error);
      showInfo('Error processing pasted files');
    }
  }, [processFiles, onFileSelected]);

  // Use ref to store the latest handlePasteFiles function
  const handlePasteFilesRef = useRef(handlePasteFiles);

  useEffect(() => {
    handlePasteFilesRef.current = handlePasteFiles;
  }, [handlePasteFiles]);

  // Listen for paste files event from native layer (macOS Command+V)
  useEffect(() => {
    // Use NativeEventEmitter with FilePasteModule for more stable event handling
    if (eventEmitter) {
      const subscription = eventEmitter.addListener('onPasteFiles', () => {
        handlePasteFilesRef.current().then();
      });
      return () => {
        subscription.remove();
      };
    }
  }, []);

  const handleChooseFiles = useCallback(async () => {
    let chooseType = [];
    const isImageMode = chatModeRef.current === ChatMode.Image;
    try {
      if (isImageMode) {
        chooseType = [types.images];
      } else {
        chooseType = [types.allFiles];
      }
      const pickResults = await pick({
        allowMultiSelection: !isImageMode,
        type: chooseType,
      });
      const files = await processFiles(pickResults);
      if (files.length > 0) {
        onFileSelected(files);
      }
    } catch (err: unknown) {
      console.info(err);
    }
  }, [processFiles, onFileSelected]);

  const handleTakeCamera = useCallback(async () => {
    const res = await launchCamera({
      saveToPhotos: false,
      mediaType:
        chatModeRef.current === ChatMode.Text && isVideoSupported()
          ? 'mixed'
          : 'photo',
      videoQuality: 'high',
      durationLimit: 30,
      includeBase64: false,
      includeExtra: true,
      presentationStyle: 'fullScreen',
    });
    const files = await getFiles(res);
    if (files.length > 0) {
      onFileSelected(files);
    }
  }, [onFileSelected]);

  const handleChooseFromPhotos = useCallback(async () => {
    const res = await launchImageLibrary({
      selectionLimit: chatModeRef.current === ChatMode.Text ? 0 : 2,
      mediaType:
        chatModeRef.current === ChatMode.Text && isVideoSupported()
          ? 'mixed'
          : 'photo',
      includeBase64: false,
      includeExtra: true,
      assetRepresentationMode: 'current',
    });
    const files = await getFiles(res);
    if (files.length > 0) {
      onFileSelected(files);
    }
  }, [onFileSelected]);

  const showActionSheet = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Camera', 'Choose From Photos', 'Choose From Files'],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) {
            handleTakeCamera();
          } else if (buttonIndex === 2) {
            handleChooseFromPhotos();
          } else if (buttonIndex === 3) {
            handleChooseFiles();
          }
        }
      );
    } else {
      // For Android, use a simple alert or show options directly
      // You may want to implement a custom modal for Android
      handleChooseFiles();
    }
  }, [handleTakeCamera, handleChooseFromPhotos, handleChooseFiles]);

  const containerStyle = mode === 'list'
    ? { ...styles.containerStyle, width: '100%' as const, height: '100%' as const, marginRight: 10 }
    : styles.containerStyle;

  if (isMac) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={handleChooseFiles}
        activeOpacity={0.7}>
        {mode === 'default' ? <DefaultIcon /> : <ThemedListIcon />}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={showActionSheet}
      activeOpacity={0.7}>
      {mode === 'default' ? <DefaultIcon /> : <ThemedListIcon />}
    </TouchableOpacity>
  );
};

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
export const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const VIDEO_FORMATS = ['mp4', 'mov', 'mkv', 'webm'];
export const EXTRA_DOCUMENT_FORMATS = [
  'json',
  'py',
  'ts',
  'tsx',
  'js',
  'kt',
  'java',
  'swift',
  'c',
  'm',
  'h',
  'sh',
  'cpp',
  'rs',
  'go',
  'class',
  'cs',
  'php',
  'rb',
  'dart',
  'sql',
  'css',
  'xml',
  'yaml',
  'yml',
];
export const DOCUMENT_FORMATS = [
  'pdf',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'html',
  'txt',
  'md',
  ...EXTRA_DOCUMENT_FORMATS,
];

export const getFileType = (format: string) => {
  if (isImageFormat(format)) {
    return FileType.image;
  } else if (isVideoFormat(format)) {
    return FileType.video;
  } else if (isDocumentFormat(format)) {
    return FileType.document;
  } else {
    return FileType.unSupported;
  }
};

export const isImageFormat = (format: string) => {
  return IMAGE_FORMATS.includes(format);
};

export const isVideoFormat = (format: string) => {
  return VIDEO_FORMATS.includes(format);
};

export const isDocumentFormat = (format: string) => {
  return DOCUMENT_FORMATS.includes(format);
};

const getFileNameWithoutExtension = (fileName: string) => {
  return fileName.substring(0, fileName.lastIndexOf('.')).trim();
};

export const isVideoSupported = (): boolean => {
  const textModelId = getTextModel().modelId;
  return textModelId.includes('nova');
};

const getFiles = async (res: ImagePickerResponse) => {
  const files: FileInfo[] = [];
  await Promise.all(
    res.assets?.map(async media => {
      if (media.fileName && media.uri) {
        const fileName = getFileNameWithoutExtension(media.fileName);
        const fileNameArr = media.fileName.split('.');
        let format = fileNameArr[fileNameArr.length - 1].toLowerCase();
        const fileType = getFileType(format);
        if (fileType === FileType.unSupported) {
          const msg = 'Selected UnSupported Files format: .' + format;
          showInfo(msg);
          return;
        }
        let width = media.width;
        let height = media.height;
        if (format === 'png' || format === 'jpg' || format === 'jpeg') {
          media.uri = await Img.compress(media.uri);
          const metaData = await getImageMetaData(media.uri);
          format = metaData.extension;
          width = metaData.ImageWidth;
          height = metaData.ImageHeight;
        }
        let thumbnailUrl;
        if (fileType === FileType.video) {
          const thumbnail = await createVideoThumbnail(media.uri);
          thumbnailUrl =
            (await saveFile(thumbnail.path, fileName + '.jpeg')) ?? '';
        }
        let localFileUrl: string | null;
        if (fileType !== FileType.video) {
          localFileUrl = await saveFile(media.uri, media.fileName);
        } else {
          localFileUrl = media.uri;
        }

        if (localFileUrl) {
          files.push({
            fileName: fileName,
            url: localFileUrl,
            videoThumbnailUrl: thumbnailUrl,
            fileSize: media.fileSize ?? 0,
            type: fileType,
            format: format === 'jpg' ? 'jpeg' : format,
            width: width,
            height: height,
          });
        }
      }
    }) ?? []
  );
  return files;
};

const styles = StyleSheet.create({
  containerStyle: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginRight: 0,
    marginLeft: 10,
  },
  listContainerStyle: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginRight: 6,
    marginLeft: 10,
  },
  imageButton: {
    width: 26,
    height: 26,
  },
  addIcon: {
    fontSize: 24,
    color: '#666',
  },
});
