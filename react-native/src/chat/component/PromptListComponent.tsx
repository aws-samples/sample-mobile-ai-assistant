import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChatMode, SystemPrompt } from '../../types/Chat.ts';
import {
  getCurrentImageSystemPrompt,
  getCurrentSystemPrompt,
  getCurrentVoiceSystemPrompt,
  getSystemPrompts,
  getTextModel,
  isTokenValid,
  savePromptId,
  saveSystemPrompts,
  getSearchProvider,
  saveSearchProvider,
} from '../../storage/StorageUtils.ts';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from '@bwjohns4/react-native-draggable-flatlist';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../../types/RouteTypes.ts';
import { useAppContext } from '../../history/AppProvider.tsx';
import Dialog from 'react-native-dialog';
import { requestToken } from '../../api/bedrock-api.ts';
import { ColorScheme, useTheme } from '../../theme';

interface PromptListProps {
  onSelectPrompt: (prompt: SystemPrompt | null) => void;
  onSwitchedToTextModel: () => void;
  chatMode: ChatMode;
}

type NavigationProp = DrawerNavigationProp<RouteParamList>;
export const PromptListComponent: React.FC<PromptListProps> = ({
  onSelectPrompt,
  onSwitchedToTextModel,
  chatMode,
}) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<NavigationProp>();
  const isImageMode = chatMode === ChatMode.Image;
  const [isNovaSonic, setIsNovaSonic] = useState(
    getTextModel().modelId.includes('sonic')
  );
  const promptType = isImageMode ? 'image' : isNovaSonic ? 'voice' : undefined;
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(
    isImageMode
      ? getCurrentImageSystemPrompt
      : isNovaSonic
      ? getCurrentVoiceSystemPrompt
      : getCurrentSystemPrompt
  );
  const [prompts, setPrompts] = useState<SystemPrompt[]>(
    getSystemPrompts(promptType)
  );
  const rawListRef = useRef<FlatList<SystemPrompt>>(null);
  const { event, sendEvent } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const deletePromptIdRef = useRef<number>(0);

  const promptsRef = useRef(prompts);
  const isNovaSonicRef = useRef(isNovaSonic);
  const onSelectPromptRef = useRef(onSelectPrompt);
  const selectedPromptRef = useRef(selectedPrompt);
  const onSwitchedToTextModelRef = useRef(onSwitchedToTextModel);
  const promptTypeRef = useRef(promptType);

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  useEffect(() => {
    isNovaSonicRef.current = isNovaSonic;
  }, [isNovaSonic]);

  useEffect(() => {
    onSelectPromptRef.current = onSelectPrompt;
  }, [onSelectPrompt]);

  useEffect(() => {
    selectedPromptRef.current = selectedPrompt;
  }, [selectedPrompt]);

  useEffect(() => {
    onSwitchedToTextModelRef.current = onSwitchedToTextModel;
  }, [onSwitchedToTextModel]);

  useEffect(() => {
    promptTypeRef.current = promptType;
  }, [promptType]);

  const handleLongPress = () => {
    setIsEditMode(true);
    scrollToEnd();
  };

  const scrollToEnd = () => {
    setTimeout(() => {
      rawListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    if (!event || event.event === '') {
      return;
    }
    if (event.event === 'unSelectSystemPrompt') {
      setSelectedPrompt(null);
      onSelectPromptRef.current(null);
    } else if (event.event === 'selectAppPrompt') {
      // Auto-select App prompt when loading a session with htmlCode
      const appPrompt = promptsRef.current.find(p => p.name === 'App');
      if (appPrompt) {
        setSelectedPrompt(appPrompt);
        onSelectPromptRef.current(appPrompt);
      }
    } else if (event.event === 'modelChanged') {
      const newIsNovaSonic = getTextModel().modelId.includes('sonic');
      if (isNovaSonicRef.current && !newIsNovaSonic) {
        onSwitchedToTextModelRef.current();
      }
      setIsNovaSonic(newIsNovaSonic);
      const newPrompt = newIsNovaSonic
        ? getCurrentVoiceSystemPrompt()
        : getCurrentSystemPrompt();
      setSelectedPrompt(newPrompt);
      onSelectPromptRef.current(newPrompt);
      setPrompts(getSystemPrompts(promptTypeRef.current));
      sendEventRef.current('');
      if (newIsNovaSonic) {
        if (!isTokenValid()) {
          requestToken().then();
        }
      }
    } else if (event.params?.prompt) {
      const newPrompt = event.params.prompt;
      if (event.event === 'onPromptUpdate') {
        const newPrompts = promptsRef.current.map(prompt =>
          prompt.id === newPrompt.id ? newPrompt : prompt
        );
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts, promptTypeRef.current);
        if (selectedPromptRef.current?.id === newPrompt.id) {
          onSelectPromptRef.current(newPrompt);
        }
      } else if (event.event === 'onPromptAdd') {
        const newPrompts = [...promptsRef.current, newPrompt];
        setPrompts(newPrompts);
        saveSystemPrompts(newPrompts, promptTypeRef.current);
        savePromptId(newPrompt.id);
        scrollToEnd();
      }
      sendEventRef.current('');
    }
  }, [event]);

  //update system prompt when chatMode changed
  useEffect(() => {
    setPrompts(getSystemPrompts(promptType));
  }, [chatMode, promptType]);

  const handlePromptSelect = (prompt: SystemPrompt) => {
    if (isEditMode) {
      navigation.navigate('Prompt', { prompt, promptType });
    } else {
      const newPrompt = selectedPrompt?.id === prompt.id ? null : prompt;
      setSelectedPrompt(newPrompt);
      onSelectPrompt(newPrompt);
      if (newPrompt !== null && getSearchProvider() !== 'disabled') {
        saveSearchProvider('disabled');
        sendEvent('searchProviderChanged');
      }
    }
  };

  const handleAddPrompt = () => {
    navigation.navigate('Prompt', {
      promptType,
    });
  };

  const handleDelete = () => {
    const newPrompts = prompts.filter(
      prompt => prompt.id !== deletePromptIdRef.current
    );
    if (selectedPrompt?.id === deletePromptIdRef.current) {
      onSelectPrompt(null);
    }
    setPrompts(newPrompts);
    saveSystemPrompts(newPrompts, promptType);
    deletePromptIdRef.current = 0;
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<SystemPrompt>) => {
    return (
      <ScaleDecorator>
        <View style={styles.promptContainer}>
          <Pressable
            onLongPress={isEditMode ? drag : handleLongPress}
            onPress={() => handlePromptSelect(item)}
            style={[
              styles.promptButton,
              selectedPrompt?.id === item.id && styles.selectedPromptButton,
              isActive && styles.draggingPrompt,
              prompts[0] === item && styles.firstButton,
              !isEditMode &&
                prompts[prompts.length - 1] === item &&
                styles.lastButton,
            ]}>
            <Text
              style={[
                styles.promptText,
                selectedPrompt?.id === item.id && styles.selectedPromptText,
              ]}>
              {item.name}
            </Text>
          </Pressable>
          {isEditMode && prompts.length > 1 && (
            <TouchableOpacity
              style={styles.deleteTouchable}
              onPress={() => {
                setShowDialog(true);
                deletePromptIdRef.current = item.id;
              }}>
              <View style={styles.deleteLayout}>
                <Text style={styles.deleteText}>×</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <DraggableFlatList
        ref={rawListRef as never}
        data={prompts}
        horizontal
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        alwaysBounceHorizontal={true}
        keyExtractor={item => item.id.toString()}
        onDragEnd={({ data }) => {
          setPrompts(data);
          saveSystemPrompts(data, promptType);
        }}
        containerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
        ListFooterComponent={
          isEditMode ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddPrompt}>
              <Text style={styles.addText}>+</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {isEditMode && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => setIsEditMode(false)}>
          <Image
            source={
              isDark
                ? require('../../assets/done_dark.png')
                : require('../../assets/done.png')
            }
            style={styles.doneImage}
          />
        </TouchableOpacity>
      )}
      <Dialog.Container visible={showDialog}>
        <Dialog.Title>
          {deletePromptIdRef.current === -7 ? 'Cannot Delete' : 'Delete Prompt'}
        </Dialog.Title>
        <Dialog.Description>
          {deletePromptIdRef.current === -7
            ? 'Virtual try on can not be deleted'
            : 'You cannot undo this action.'}
        </Dialog.Description>
        {deletePromptIdRef.current !== -7 && (
          <Dialog.Button
            label="Cancel"
            onPress={() => {
              setShowDialog(false);
            }}
          />
        )}
        <Dialog.Button
          label={deletePromptIdRef.current === -7 ? 'OK' : 'Delete'}
          onPress={() => {
            if (deletePromptIdRef.current !== -7) {
              handleDelete();
            }
            setShowDialog(false);
          }}
        />
      </Dialog.Container>
    </View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
    },
    scrollContent: {
      flex: 1,
    },
    promptButton: {
      height: 36,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.promptButtonBackground,
      borderRadius: 8,
      marginLeft: 8,
      borderWidth: 1.3,
      borderColor: colors.promptButtonBorder,
    },
    firstButton: {
      marginLeft: 10,
    },
    lastButton: {
      marginRight: 10,
    },
    selectedPromptButton: {
      backgroundColor: colors.promptButtonBackground,
      borderColor: colors.promptSelectedBorder,
    },
    promptText: {
      fontSize: 14,
      marginTop: Platform.OS === 'android' ? -2 : 0,
      color: colors.promptText,
    },
    selectedPromptText: {
      color: colors.text,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 20,
      marginTop: 17,
      marginLeft: 8,
      backgroundColor: colors.promptAddButtonBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.3,
      borderColor: colors.promptAddButtonBorder,
    },
    addText: {
      fontSize: 20,
      color: colors.promptAddText,
      marginTop: -1.5,
    },
    doneButton: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
    },
    doneImage: {
      width: 20,
      height: 20,
    },
    promptContainer: {
      alignSelf: 'center',
      marginTop: 6,
    },
    deleteTouchable: {
      position: 'absolute',
      right: -8,
      top: -8,
      zIndex: 1,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLayout: {
      width: 16,
      height: 16,
      backgroundColor: colors.promptDeleteBackground,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      color: colors.promptDeleteText,
      fontSize: 12,
      marginTop: -1.8,
      marginRight: -0.5,
      fontWeight: 'normal',
    },
    draggingPrompt: {
      opacity: 0.9,
    },
  });
