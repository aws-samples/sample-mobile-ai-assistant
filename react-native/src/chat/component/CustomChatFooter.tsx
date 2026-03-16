import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SystemPrompt,
} from '../../types/Chat.ts';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import { PromptListComponent } from './PromptListComponent.tsx';
import { ModelIconButton } from './ModelIconButton.tsx';
import { ModelSelectionModal } from './ModelSelectionModal.tsx';
import { WebSearchIconButton } from './WebSearchIconButton.tsx';
import { WebSearchSelectionModal } from './WebSearchSelectionModal.tsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAndroid } from '../../utils/PlatformUtils.ts';

interface CustomComposerProps {
  files: FileInfo[];
  onFileUpdated: (files: FileInfo[], isUpdate?: boolean) => void;
  onSystemPromptUpdated: (prompt: SystemPrompt | null) => void;
  onSwitchedToTextModel: () => void;
  chatMode: ChatMode;
  hasInputText?: boolean;
  chatStatus?: ChatStatus;
  systemPrompt?: SystemPrompt | null;
}

export const CustomChatFooter: React.FC<CustomComposerProps> = ({
  files,
  onFileUpdated,
  onSystemPromptUpdated,
  onSwitchedToTextModel,
  chatMode,
  hasInputText = false,
  chatStatus,
  systemPrompt,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [iconPosition, setIconPosition] = useState({ x: 0, y: 0 });
  const [searchIconPosition, setSearchIconPosition] = useState({ x: 0, y: 0 });
  const modelIconRef = useRef<View>(null);
  const searchIconRef = useRef<View>(null);
  const iconPositionRef = useRef({ x: 0, y: 0 });
  const searchIconPositionRef = useRef({ x: 0, y: 0 });
  const insets = useSafeAreaInsets();
  const statusBarHeight = useRef(insets.top);
  const isVirtualTryOn = systemPrompt?.id === -7;
  const modeOnImage =
    files.length === 1 && isVirtualTryOn
      ? DisplayMode.Edit
      : DisplayMode.GenImage;

  const handleOpenModal = () => {
    if (iconPositionRef.current.y === 0) {
      modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        iconPositionRef.current = {
          x: pageX,
          y: pageY + (isAndroid ? statusBarHeight.current - 32 : 10),
        };
        setIconPosition(iconPositionRef.current);
        setModalVisible(true);
      });
    } else {
      setModalVisible(true);
    }
  };

  const handleOpenSearchModal = () => {
    if (searchIconPositionRef.current.y === 0) {
      searchIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        searchIconPositionRef.current = {
          x: pageX,
          y: pageY + (isAndroid ? statusBarHeight.current - 32 : 10),
        };
        setSearchIconPosition(searchIconPositionRef.current);
        setSearchModalVisible(true);
      });
    } else {
      setSearchModalVisible(true);
    }
  };

  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', () => {
      modelIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (iconPositionRef.current.y === 0) {
          iconPositionRef.current = {
            x: pageX,
            y: pageY + (isAndroid ? statusBarHeight.current - 32 : 10),
          };
          setIconPosition(iconPositionRef.current);
        }
      });
      searchIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (searchIconPositionRef.current.y === 0) {
          searchIconPositionRef.current = {
            x: pageX,
            y: pageY + (isAndroid ? statusBarHeight.current - 32 : 10),
          };
          setSearchIconPosition(searchIconPositionRef.current);
        }
      });
    });
  }, []);

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleCloseSearchModal = () => {
    setSearchModalVisible(false);
  };
  const isHideFileList = hasInputText || chatStatus === ChatStatus.Running;

  return (
    <>
      <View
        style={{
          ...styles.container,
          ...(files.length > 0 && {
            height: 136,
          }),
          ...(files.length === 0 && {
            height: 60,
          }),
        }}>
        {(isHideFileList || files.length > 0) && (
          <CustomFileListComponent
            files={files}
            onFileUpdated={onFileUpdated}
            mode={chatMode === ChatMode.Image ? modeOnImage : DisplayMode.Edit}
            isHideFileList={isHideFileList}
          />
        )}
        {(chatMode === ChatMode.Text || chatMode === ChatMode.Image) && (
          <View
            style={{
              ...styles.promptContainer,
              ...(files.length > 0 && {
                marginTop: -72,
              }),
            }}>
            <PromptListComponent
              onSelectPrompt={prompt => {
                onSystemPromptUpdated(prompt);
              }}
              onSwitchedToTextModel={() => {
                onSwitchedToTextModel();
              }}
              chatMode={chatMode}
            />
            {chatMode === ChatMode.Text && (
              <>
                <View ref={searchIconRef} collapsable={false}>
                  <WebSearchIconButton onPress={handleOpenSearchModal} />
                </View>
                <View ref={modelIconRef} collapsable={false}>
                  <ModelIconButton onPress={handleOpenModal} />
                </View>
              </>
            )}
          </View>
        )}
      </View>
      <ModelSelectionModal
        visible={modalVisible}
        onClose={handleCloseModal}
        iconPosition={iconPosition}
      />
      <WebSearchSelectionModal
        visible={searchModalVisible}
        onClose={handleCloseSearchModal}
        iconPosition={searchIconPosition}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  promptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: 0,
  },
});
