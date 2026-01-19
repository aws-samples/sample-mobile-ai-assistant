import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { ChatMode, FileInfo, FileType } from '../../types/Chat.ts';
import { getImageModel, getTextModel } from '../../storage/StorageUtils.ts';
import { showInfo } from './ToastUtils.ts';

export const saveImageToLocal = async (
  base64ImageData: string
): Promise<string> => {
  try {
    const imageName = `image_${Date.now()}.png`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${imageName}`;
    await RNFS.writeFile(filePath, base64ImageData, 'base64');
    return Platform.OS === 'android' ? `file://${filePath}` : imageName;
  } catch (error) {
    console.info('Error saving image:', error);
    return '';
  }
};

export const saveFile = async (sourceUrl: string, fileName: string) => {
  try {
    const filesDir = `${RNFS.DocumentDirectoryPath}/files`;
    const filesDirExists = await RNFS.exists(filesDir);
    if (!filesDirExists) {
      await RNFS.mkdir(filesDir);
    }
    const uniqueFileName = getUniqueFileName(fileName);
    const destinationPath = `${filesDir}/${uniqueFileName}`;
    await RNFS.copyFile(sourceUrl, destinationPath);
    return Platform.OS === 'android'
      ? `file://${destinationPath}`
      : `files/${uniqueFileName}`;
  } catch (error) {
    console.warn('Error saving file:', error);
  }
  return null;
};

export const getFileBytes = async (fileUrl: string) => {
  try {
    const fullFileUrl = getFullFileUrl(fileUrl);
    return await RNFS.readFile(fullFileUrl, 'base64');
  } catch (error) {
    console.warn('Error reading image file:', fileUrl, error);
    throw error;
  }
};

export const getFileTextContent = async (fileUrl: string): Promise<string> => {
  try {
    const fullFileUrl = getFullFileUrl(fileUrl);
    return await RNFS.readFile(fullFileUrl, 'utf8');
  } catch (error) {
    console.warn('Error reading text file:', fileUrl, error);
    throw error;
  }
};

const getUniqueFileName = (originalFileName: string): string => {
  const lastDotIndex = originalFileName.lastIndexOf('.');
  const nameWithoutExt = originalFileName.substring(0, lastDotIndex);
  const extension = originalFileName.substring(lastDotIndex);
  const timestamp = Date.now();
  return `${nameWithoutExt}_${timestamp}${extension}`;
};

export const getFullFileUrl = (url: string) => {
  if (Platform.OS === 'android') {
    return url;
  } else if (url.startsWith('files/')) {
    return `${RNFS.DocumentDirectoryPath}/${url}`;
  } else {
    return (
      RNFS.DocumentDirectoryPath +
      '/files' +
      url.substring(url.lastIndexOf('/'))
    );
  }
};

const MAX_IMAGES = 20;
const MAX_DOCUMENTS = 5;
const MAX_NOVA_FILES = 5;
const MAX_NOVA_VIDEOS = 1;

export const checkFileNumberLimit = (
  prevFiles: FileInfo[],
  newFiles: FileInfo[],
  chatMode: ChatMode,
  isVirtualTryOn: boolean = false
) => {
  const existingImages = prevFiles.filter(file => file.type === FileType.image);
  const existingDocs = prevFiles.filter(
    file => file.type === FileType.document
  );
  const newImages = newFiles.filter(file => file.type === FileType.image);
  const newDocs = newFiles.filter(file => file.type === FileType.document);

  const totalImages = existingImages.length + newImages.length;
  const totalDocs = existingDocs.length + newDocs.length;

  let processedNewImages = newImages;
  let processedNewDocs = newDocs;
  let showWarning = false;

  if (chatMode === ChatMode.Image && isNovaCanvas()) {
    const maxFilesAllowed = isVirtualTryOn ? 2 : 1;
    if (prevFiles.length + newFiles.length > maxFilesAllowed) {
      showInfo(`Maximum ${maxFilesAllowed} image allowed`);
    }
    const allFiles = [...prevFiles, ...newFiles];
    return allFiles.slice(0, maxFilesAllowed);
  }

  if (isNova()) {
    if (prevFiles.length + newFiles.length > MAX_NOVA_FILES) {
      showInfo(`Maximum ${MAX_NOVA_FILES} files allowed`);
    }
    if (prevFiles.length >= MAX_NOVA_FILES) {
      return prevFiles;
    }
    const existingVideos = prevFiles.filter(
      file => file.type === FileType.video
    ).length;
    const newVideos = newFiles.filter(file => file.type === FileType.video);

    if (existingVideos + newVideos.length > MAX_NOVA_VIDEOS) {
      showInfo(`Maximum ${MAX_NOVA_VIDEOS} video allowed`);
    }

    const filteredNewFiles =
      existingVideos >= MAX_NOVA_VIDEOS
        ? newFiles.filter(file => file.type !== FileType.video)
        : newFiles.filter(
            file =>
              file.type !== FileType.video ||
              newVideos.indexOf(file) < MAX_NOVA_VIDEOS - existingVideos
          );

    return [...prevFiles, ...filteredNewFiles].slice(0, MAX_NOVA_FILES);
  }

  if (totalImages > MAX_IMAGES) {
    const remainingSlots = Math.max(0, MAX_IMAGES - existingImages.length);
    processedNewImages = newImages.slice(0, remainingSlots);
    showWarning = true;
  }

  if (totalDocs > MAX_DOCUMENTS) {
    const remainingSlots = Math.max(0, MAX_DOCUMENTS - existingDocs.length);
    processedNewDocs = newDocs.slice(0, remainingSlots);
    showWarning = true;
  }

  if (showWarning) {
    if (totalImages > MAX_IMAGES) {
      showInfo(`Image limit exceeded, maximum ${MAX_IMAGES} images allowed`);
    }
    if (totalDocs > MAX_DOCUMENTS) {
      showInfo(
        `Document limit exceeded, maximum ${MAX_DOCUMENTS} files allowed`
      );
    }
  }
  return [...prevFiles, ...processedNewImages, ...processedNewDocs];
};

const isNova = (): boolean => {
  const textModelId = getTextModel().modelId;
  return textModelId.includes('nova-');
};

const isNovaCanvas = (): boolean => {
  const imageModelId = getImageModel().modelId;
  return imageModelId.includes('nova-canvas');
};

export const isAllFileReady = (files: FileInfo[]) => {
  const videos = files.filter(file => file.type === FileType.video);
  if (videos.length > 0) {
    return videos.filter(video => video.videoUrl === undefined).length === 0;
  } else {
    return true;
  }
};

export const getFileTypeSummary = (files: FileInfo[]) => {
  if (files.length === 1) {
    return 'Summarize this';
  }

  const imgCount = files.filter(file => file.type === FileType.image).length;
  const docCount = files.filter(file => file.type === FileType.document).length;
  const videoCount = files.filter(file => file.type === FileType.video).length;

  const types = [
    imgCount && `${imgCount > 1 ? 'images' : 'image'}`,
    docCount && `${docCount > 1 ? 'docs' : 'doc'}`,
    videoCount && `${videoCount > 1 ? 'videos' : 'video'}`,
  ].filter(Boolean);

  return `Summarize these ${types.join(' and ')}`;
};
