import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  RefObject,
} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { CustomMarkdownRenderer } from './markdown/CustomMarkdownRenderer.tsx';
import { MarkedStyles } from 'react-native-marked/src/theme/types.ts';
import { ChatStatus, PressMode, SwiftChatMessage } from '../../types/Chat.ts';
import { trigger } from '../util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  CustomFileListComponent,
  DisplayMode,
} from './CustomFileListComponent.tsx';
import FileViewer from 'react-native-file-viewer';
import { isMac } from '../../App.tsx';
import { CustomTokenizer } from './markdown/CustomTokenizer.ts';
import Markdown from './markdown/Markdown.tsx';
import ImageSpinner from './ImageSpinner.tsx';
import { State, TapGestureHandler } from 'react-native-gesture-handler';
import { getModelIcon, getModelTagByUserName } from '../../utils/ModelUtils.ts';
import { isAndroid } from '../../utils/PlatformUtils.ts';
import { useAppContext } from '../../history/AppProvider.tsx';
import { useTheme, ColorScheme } from '../../theme';
import {
  getReasoningExpanded,
  saveReasoningExpanded,
} from '../../storage/StorageUtils.ts';
import CitationList from './CitationList';

export interface CustomMessageProps {
  currentMessage: SwiftChatMessage;
  position?: 'left' | 'right';
  chatStatus: ChatStatus;
  isLastAIMessage?: boolean;
  searchPhase?: string;
  onReasoningToggle?: (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => void;
  messageIndex?: number;
  regenerateFromUserMessage?: (
    userMessageIndex: number,
    newText?: string
  ) => void;
  flatListRef?: RefObject<FlatList<SwiftChatMessage> | null>;
  isAppMode?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

const CustomMessageComponent: React.FC<CustomMessageProps> = ({
  currentMessage,
  chatStatus,
  isLastAIMessage,
  searchPhase,
  onReasoningToggle,
  messageIndex,
  regenerateFromUserMessage,
  flatListRef,
  isAppMode,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);
  const [clickTitleCopied, setClickTitleCopied] = useState(false);
  const [reasoningCopied, setReasoningCopied] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] =
    useState(getReasoningExpanded);
  const reasoningContainerRef = useRef<View>(null);
  const reasoningContainerHeightRef = useRef<number>(0);
  const [isEdit, setIsEdit] = useState(false);
  const [editText, setEditText] = useState(currentMessage?.text || '');

  const chatStatusRef = useRef(chatStatus);
  const textInputRef = useRef<TextInput>(null);
  const [inputTextSelection, setInputTextSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const isLoading =
    chatStatus === ChatStatus.Running &&
    (currentMessage?.text === '...' || currentMessage?.text === '');
  const [forceShowButtons, setForceShowButtons] = useState(false);
  const isUser = useRef(currentMessage?.user?._id === 1);
  // Force re-render key for Android citation badge layout fix
  const [citationRenderKey, setCitationRenderKey] = useState(0);
  const { drawerType } = useAppContext();
  const chatScreenWidth =
    isMac && drawerType === 'permanent' ? screenWidth - 300 : screenWidth;

  const setIsEditValue = useCallback(
    (value: boolean) => {
      if (chatStatus !== ChatStatus.Running) {
        setIsEdit(value);
        if (value) {
          // Reset editText when entering edit mode
          setEditText(currentMessage?.text || '');
          // Scroll to make the editing message visible above keyboard
          if (
            flatListRef?.current &&
            messageIndex !== undefined &&
            messageIndex >= 0
          ) {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: messageIndex,
                animated: true,
                viewPosition: 0,
              });
            }, 500);
          }
        } else {
          setInputTextSelection(undefined);
        }
      }
    },
    [chatStatus, currentMessage?.text, flatListRef, messageIndex]
  );

  const handleLongPressEdit = useCallback(() => {
    if (isUser.current && chatStatus !== ChatStatus.Running) {
      trigger(HapticFeedbackTypes.impactMedium);
      setIsEditValue(true);
    }
  }, [chatStatus, setIsEditValue]);

  const handleEditSubmit = useCallback(() => {
    if (editText.trim() && editText.trim() !== currentMessage?.text?.trim()) {
      // For user message: messageIndex is the user message position
      if (messageIndex !== undefined) {
        regenerateFromUserMessage?.(messageIndex, editText.trim());
      }
      setIsEdit(false);
      setInputTextSelection(undefined);
    } else {
      // If text unchanged, just exit edit mode
      setIsEdit(false);
      setInputTextSelection(undefined);
    }
  }, [editText, currentMessage?.text, messageIndex, regenerateFromUserMessage]);

  const handleEditCancel = useCallback(() => {
    setIsEdit(false);
    setEditText(currentMessage?.text || '');
    setInputTextSelection(undefined);
  }, [currentMessage?.text]);

  const handleRegenerate = useCallback(() => {
    // For inverted list [newest...oldest]: AI message (index 0) is before user message (index 1)
    // So userMessageIndex = messageIndex + 1
    if (messageIndex !== undefined) {
      const userMessageIndex = messageIndex + 1;
      regenerateFromUserMessage?.(userMessageIndex);
    }
  }, [messageIndex, regenerateFromUserMessage]);

  // Focus TextInput and move cursor to end when entering edit mode
  useEffect(() => {
    if (isEdit && isUser.current) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isAndroid && isEdit && currentMessage?.text) {
      // For non-user messages on iOS/Mac, select all text
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
        setInputTextSelection({
          start: 0,
          end: currentMessage.text.length,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEdit, currentMessage?.text]);

  const toggleButtons = useCallback(() => {
    setForceShowButtons(prev => !prev);
  }, []);

  // Handle selection changes made by the user
  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { selection } = event.nativeEvent;
      setInputTextSelection(selection);
    },
    []
  );

  const handleCopy = useCallback(() => {
    const copyText = currentMessage?.text.trim() || '';
    Clipboard.setString(copyText);
  }, [currentMessage?.text]);

  const handleReasoningCopy = useCallback(() => {
    const copyText = currentMessage?.reasoning?.trim() || '';
    Clipboard.setString(copyText);
  }, [currentMessage?.reasoning]);

  const currentUser = currentMessage?.user;
  const showRefresh =
    !isUser.current && !currentUser?.name?.includes('Nova Sonic');

  const userInfo = useMemo(() => {
    if (!currentMessage || !currentMessage.user) {
      return {
        userName: '',
        modelIcon: isDark
          ? require('../../assets/bedrock_dark.png')
          : require('../../assets/bedrock.png'),
      };
    }
    const user = currentMessage.user;
    const userName = user.name ?? 'Bedrock';
    const currentModelTag = getModelTagByUserName(user.modelTag, userName);

    const modelIcon = getModelIcon(currentModelTag, undefined, isDark);
    return { userName, modelIcon };
  }, [currentMessage, isDark]);

  const headerContent = useMemo(() => {
    return (
      <>
        <Image source={userInfo.modelIcon} style={styles.avatar} />
        <Text style={styles.name}>{userInfo.userName}</Text>
      </>
    );
  }, [userInfo, styles.avatar, styles.name]);

  const copyButton = useMemo(() => {
    return clickTitleCopied ? (
      <Image
        source={
          isDark
            ? require('../../assets/done_dark.png')
            : require('../../assets/done.png')
        }
        style={styles.copy}
      />
    ) : null;
  }, [clickTitleCopied, isDark, styles.copy]);

  const handleImagePress = useCallback((pressMode: PressMode, url: string) => {
    if (pressMode === PressMode.Click) {
      FileViewer.open(url)
        .then(() => {})
        .catch(error => {
          console.log(error);
        });
    } else if (pressMode === PressMode.LongPress) {
      trigger(HapticFeedbackTypes.notificationSuccess);
      const shareOptions = { url: url, type: 'image/png', title: 'AI Image' };
      Share.open(shareOptions)
        .then(res => console.log(res))
        .catch(err => err && console.log(err));
    }
  }, []);

  const customMarkdownRenderer = useMemo(
    () =>
      new CustomMarkdownRenderer(
        handleImagePress,
        colors,
        isDark,
        currentMessage?.citations || [],
        onReasoningToggle,
        currentMessage?.htmlCode,
        currentMessage?.diffCode,
        isAppMode,
        currentMessage?.isLastHtml
      ),
    [
      handleImagePress,
      colors,
      isDark,
      currentMessage?.citations,
      onReasoningToggle,
      currentMessage?.htmlCode,
      currentMessage?.diffCode,
      isAppMode,
      currentMessage?.isLastHtml,
    ]
  );

  const customTokenizer = useMemo(() => new CustomTokenizer(), []);

  const handleReasoningToggle = useCallback(() => {
    if (reasoningExpanded && reasoningContainerHeightRef.current === 0) {
      reasoningContainerRef.current?.measure((_x, _y, _width, height) => {
        reasoningContainerHeightRef.current = height;
        const newExpanded = !reasoningExpanded;
        setReasoningExpanded(newExpanded);
        saveReasoningExpanded(newExpanded);
        onReasoningToggle?.(
          newExpanded,
          reasoningContainerHeightRef.current ?? 0,
          false
        );
      });
    } else {
      const newExpanded = !reasoningExpanded;
      if (reasoningContainerHeightRef.current === 0) {
        setReasoningExpanded(newExpanded);
        setTimeout(() => {
          if (reasoningContainerRef.current) {
            reasoningContainerRef.current?.measure((_x, _y, _width, height) => {
              reasoningContainerHeightRef.current = height;
              onReasoningToggle?.(newExpanded, height ?? 0, true);
            });
          }
        }, 150);
      } else {
        setTimeout(() => {
          onReasoningToggle?.(
            newExpanded,
            reasoningContainerHeightRef.current ?? 0,
            false
          );
        }, 0);
        setReasoningExpanded(newExpanded);
      }
      saveReasoningExpanded(newExpanded);
    }
  }, [reasoningExpanded, onReasoningToggle]);

  const reasoningSection = useMemo(() => {
    if (
      !currentMessage?.reasoning ||
      currentMessage?.reasoning.length === 0 ||
      isUser.current
    ) {
      return null;
    }

    return (
      <View style={styles.reasoningContainer}>
        <TouchableOpacity
          style={styles.reasoningHeader}
          activeOpacity={1}
          onPress={handleReasoningToggle}>
          <View style={styles.reasoningHeaderContent}>
            <Image
              source={
                isDark
                  ? require('../../assets/back_dark.png')
                  : require('../../assets/back.png')
              }
              style={[
                styles.reasoningArrowIcon,
                {
                  transform: [
                    { rotate: reasoningExpanded ? '270deg' : '180deg' },
                  ],
                },
              ]}
            />
            <Text style={styles.reasoningTitle}>Reasoning</Text>
          </View>
          <TouchableOpacity
            hitSlop={8}
            onPress={e => {
              e.stopPropagation();
              setReasoningCopied(true);
            }}>
            <Image
              source={
                reasoningCopied
                  ? isDark
                    ? require('../../assets/done_dark.png')
                    : require('../../assets/done.png')
                  : isDark
                    ? require('../../assets/copy_grey.png')
                    : require('../../assets/copy.png')
              }
              style={styles.reasoningCopyIcon}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {reasoningExpanded && (
          <View ref={reasoningContainerRef} style={styles.reasoningContent}>
            <Markdown
              value={currentMessage.reasoning}
              flatListProps={{
                style: {
                  backgroundColor: colors.reasoningBackground,
                },
              }}
              styles={customMarkedStyles}
              renderer={customMarkdownRenderer}
              tokenizer={customTokenizer}
              chatStatus={chatStatusRef.current}
            />
          </View>
        )}
      </View>
    );
  }, [
    currentMessage,
    customMarkdownRenderer,
    customTokenizer,
    colors.reasoningBackground,
    styles.reasoningContainer,
    styles.reasoningHeader,
    styles.reasoningHeaderContent,
    styles.reasoningTitle,
    styles.reasoningArrowIcon,
    styles.reasoningCopyIcon,
    styles.reasoningContent,
    isDark,
    reasoningExpanded,
    reasoningCopied,
    handleReasoningToggle,
  ]);

  const handleShowButton = useCallback(() => {
    if (!isLoading) {
      toggleButtons();
    }
  }, [isLoading, toggleButtons]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    if (clickTitleCopied) {
      handleCopy();
      const timer = setTimeout(() => {
        setClickTitleCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [handleCopy, clickTitleCopied]);

  useEffect(() => {
    if (reasoningCopied) {
      handleReasoningCopy();
      const timer = setTimeout(() => {
        setReasoningCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [handleReasoningCopy, reasoningCopied]);

  // Android: Force re-render citation badges after streaming completes
  // to fix inline layout issues that occur during streaming
  useEffect(() => {
    if (
      isAndroid &&
      chatStatus !== ChatStatus.Running &&
      chatStatusRef.current === ChatStatus.Running &&
      currentMessage?.citations &&
      currentMessage.citations.length > 0
    ) {
      // Delay slightly to ensure the streaming has fully stopped
      const timer = setTimeout(() => {
        setCitationRenderKey(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
    chatStatusRef.current = chatStatus;
  }, [chatStatus, currentMessage?.citations]);

  const messageContent = useMemo(() => {
    if (!currentMessage) {
      return null;
    }

    if (!isUser.current) {
      return (
        <Markdown
          key={citationRenderKey}
          value={currentMessage.text}
          styles={customMarkedStyles}
          renderer={customMarkdownRenderer}
          tokenizer={customTokenizer}
          chatStatus={chatStatusRef.current}
        />
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        delayLongPress={300}
        onLongPress={handleLongPressEdit}
        style={{
          ...styles.questionContainer,
          maxWidth: (chatScreenWidth * 3) / 4,
        }}>
        <Text style={styles.questionText} selectable>
          {currentMessage.text}
        </Text>
      </TouchableOpacity>
    );
  }, [
    currentMessage,
    customMarkdownRenderer,
    customTokenizer,
    chatScreenWidth,
    styles.questionContainer,
    styles.questionText,
    citationRenderKey,
    handleLongPressEdit,
  ]);

  const messageActionButtons = useMemo(() => {
    const metricsText = currentMessage?.metrics
      ? `latency ${currentMessage.metrics.latencyMs}s | ${currentMessage.metrics.speed} tok/s`
      : null;
    return (
      <View
        style={{
          ...styles.actionButtonsContainer,
          ...{ justifyContent: isUser.current ? 'flex-end' : 'space-between' },
        }}>
        <View style={styles.actionButtonInnerContainer}>
          <TouchableOpacity
            onPress={() => {
              handleCopy();
              setCopied(true);
            }}
            style={styles.actionButton}>
            <Image
              source={
                copied
                  ? isDark
                    ? require('../../assets/done_dark.png')
                    : require('../../assets/done.png')
                  : require('../../assets/copy_grey.png')
              }
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsEditValue(!isEdit)}
            style={styles.actionButton}>
            <Image
              source={
                isEdit
                  ? isDark
                    ? require('../../assets/select_dark.png')
                    : require('../../assets/select.png')
                  : require('../../assets/select_grey.png')
              }
              style={styles.actionButtonIcon}
            />
          </TouchableOpacity>

          {showRefresh && (
            <TouchableOpacity
              onPress={handleRegenerate}
              style={styles.actionButton}>
              <Image
                source={require('../../assets/refresh.png')}
                style={styles.actionButtonIcon}
              />
            </TouchableOpacity>
          )}
        </View>

        {metricsText && !isUser.current && (
          <Text style={styles.metricsText}>{metricsText}</Text>
        )}
      </View>
    );
  }, [
    handleCopy,
    copied,
    isEdit,
    handleRegenerate,
    setIsEditValue,
    showRefresh,
    currentMessage?.metrics,
    isDark,
    styles.actionButtonsContainer,
    styles.actionButtonInnerContainer,
    styles.actionButton,
    styles.actionButtonIcon,
    styles.metricsText,
  ]);

  if (!currentMessage) {
    return null;
  }
  const hasReasoning = (currentMessage?.reasoning?.length ?? 0) > 0;
  const showLoading = isLoading && !(hasReasoning && reasoningExpanded);
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={1}
        onPress={() => setClickTitleCopied(true)}>
        {!isUser.current && headerContent}
        {copyButton}
      </TouchableOpacity>
      <View style={styles.marked_box}>
        {hasReasoning && reasoningSection}
        {showLoading && (
          <View style={styles.loadingContainer}>
            <ImageSpinner
              visible={true}
              size={18}
              source={require('../../assets/loading.png')}
            />
            {searchPhase && (
              <Text style={styles.searchPhaseText}>{searchPhase}</Text>
            )}
          </View>
        )}
        {!isLoading && !isEdit && (
          <TapGestureHandler
            numberOfTaps={2}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.ACTIVE) {
                handleShowButton();
              }
            }}>
            <View>{messageContent}</View>
          </TapGestureHandler>
        )}
        {isEdit && (
          <View
            style={[
              isUser.current && styles.editContainer,
              isUser.current && { maxWidth: (chatScreenWidth * 3) / 4 },
            ]}>
            <TextInput
              ref={textInputRef}
              selection={inputTextSelection}
              onSelectionChange={handleSelectionChange}
              editable={isUser.current ? true : Platform.OS === 'android'}
              multiline
              showSoftInputOnFocus={isUser.current ? true : false}
              value={isUser.current ? editText : undefined}
              onChangeText={isUser.current ? setEditText : undefined}
              style={{
                ...styles.inputText,
                ...{
                  fontWeight: isMac ? '300' : 'normal',
                  lineHeight: isMac ? 26 : 24,
                  paddingTop: Platform.OS === 'android' ? 7 : 3,
                  paddingBottom: 8,
                },
                ...(isUser.current && {
                  backgroundColor: colors.messageBackground,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 8,
                }),
              }}
              textAlignVertical="top">
              {isUser.current ? undefined : currentMessage.text}
            </TextInput>
            {isUser.current && (
              <View style={styles.editButtonsContainer}>
                <TouchableOpacity
                  onPress={handleEditCancel}
                  style={styles.editCancelButton}>
                  <Text style={styles.editCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEditSubmit}
                  style={[
                    styles.editSubmitButton,
                    !editText.trim() && styles.editSubmitButtonDisabled,
                  ]}>
                  <Text style={styles.editSubmitButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {!isUser.current &&
          chatStatus !== ChatStatus.Running &&
          currentMessage.citations && (
            <CitationList citations={currentMessage.citations} />
          )}
        {((isLastAIMessage && chatStatus !== ChatStatus.Running) ||
          forceShowButtons) &&
          messageActionButtons}
        {currentMessage.image && (
          <CustomFileListComponent
            files={JSON.parse(currentMessage.image)}
            mode={DisplayMode.Display}
          />
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      marginLeft: 12,
      marginVertical: 4,
    },
    marked_box: {
      marginLeft: 28,
      marginRight: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 0,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginRight: 6,
    },
    copy: {
      width: 18,
      height: 18,
      marginRight: 20,
      marginLeft: 'auto',
    },
    name: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    questionContainer: {
      alignSelf: 'flex-end',
      backgroundColor: colors.messageBackground,
      borderRadius: 22,
      overflow: 'hidden',
      marginVertical: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    editContainer: {
      alignSelf: 'flex-end',
    },
    questionText: {
      lineHeight: 24,
      fontSize: 16,
      color: colors.text,
    },
    inputText: {
      fontSize: 16,
      lineHeight: 26,
      textAlignVertical: 'top',
      marginTop: 1,
      padding: 0,
      fontWeight: '300',
      color: colors.text,
      letterSpacing: 0,
    },
    reasoningContainer: {
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: colors.reasoningBackground,
      overflow: 'hidden',
      marginTop: 8,
    },
    reasoningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 8,
      backgroundColor: colors.borderLight,
    },
    reasoningHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reasoningArrowIcon: {
      width: 14,
      height: 14,
      marginRight: 4,
    },
    reasoningTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    reasoningContent: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 10,
    },
    searchPhaseText: {
      marginLeft: 8,
      fontSize: 14,
      color: colors.textTertiary,
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -8,
      marginTop: -2,
      marginBottom: 4,
    },
    actionButtonInnerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      padding: 8,
    },
    actionButtonIcon: {
      width: 16,
      height: 16,
    },
    metricsText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginRight: 4,
    },
    reasoningCopyIcon: {
      width: 16,
      height: 16,
    },
    editButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
      gap: 8,
    },
    editCancelButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.borderLight,
    },
    editCancelButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    editSubmitButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    editSubmitButtonDisabled: {
      opacity: 0.5,
    },
    editSubmitButtonText: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '500',
    },
  });

const customMarkedStyles: MarkedStyles = {
  table: { marginVertical: 4 },
  list: { marginVertical: 4 },
  h1: { fontSize: 28 },
  h2: { fontSize: 24 },
  h3: { fontSize: 20 },
  h4: { fontSize: 18 },
  blockquote: { marginVertical: 8 },
  paragraph: { paddingVertical: 6 },
};

export default React.memo(CustomMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.currentMessage?.text === nextProps.currentMessage?.text &&
    prevProps.currentMessage?.image === nextProps.currentMessage?.image &&
    prevProps.currentMessage?.reasoning ===
      nextProps.currentMessage?.reasoning &&
    prevProps.currentMessage?.htmlCode === nextProps.currentMessage?.htmlCode &&
    prevProps.currentMessage?.isLastHtml ===
      nextProps.currentMessage?.isLastHtml &&
    prevProps.chatStatus === nextProps.chatStatus &&
    prevProps.isLastAIMessage === nextProps.isLastAIMessage &&
    prevProps.searchPhase === nextProps.searchPhase &&
    prevProps.messageIndex === nextProps.messageIndex
  );
});
