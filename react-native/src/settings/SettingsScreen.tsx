import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Dialog from 'react-native-dialog';
import RNFS from 'react-native-fs';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { setHapticFeedbackEnabled, trigger } from '../chat/util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src';
import {
  getAllImageSize,
  getAllModels,
  getApiKey,
  getApiUrl,
  getDeepSeekApiKey,
  getHapticEnabled,
  getImageModel,
  getImageSize,
  getModelUsage,
  getOllamaApiUrl,
  getOllamaApiKey,
  getOpenAIApiKey,
  getOpenAIProxyEnabled,
  getRegion,
  getTextModel,
  getThinkingEnabled,
  getVoiceId,
  isNewStabilityImageModel,
  saveAllModels,
  saveDeepSeekApiKey,
  saveImageModel,
  saveImageSize,
  saveKeys,
  saveOllamaApiURL,
  saveOllamaApiKey,
  saveOpenAIApiKey,
  saveOpenAIProxyEnabled,
  saveRegion,
  saveTextModel,
  saveThinkingEnabled,
  saveVoiceId,
  updateTextModelUsageOrder,
  getBedrockConfigMode,
  saveBedrockConfigMode,
  getBedrockApiKey,
  saveBedrockApiKey,
  generateOpenAICompatModels,
  getOpenAICompatConfigs,
  getTavilyApiKey,
  saveTavilyApiKey,
  clearAllChatHistory,
} from '../storage/StorageUtils.ts';
import { CustomHeaderRightButton } from '../chat/component/CustomHeaderRightButton.tsx';
import { RouteParamList } from '../types/RouteTypes.ts';
import { requestAllModels, requestUpgradeInfo } from '../api/bedrock-api.ts';
import {
  DropdownItem,
  Model,
  UpgradeInfo,
  OpenAICompatConfig,
  ModelTag,
} from '../types/Chat.ts';

import packageJson from '../../package.json';
import { isMac } from '../App.tsx';
import { getBuildNumber } from '../utils/PlatformUtils.ts';
import CustomDropdown from './DropdownComponent.tsx';
import {
  addBedrockPrefixToDeepseekModels,
  getTotalCost,
} from './ModelPrice.ts';
import {
  BedrockThinkingModels,
  BedrockVoiceModels,
  DefaultTextModel,
  getAllRegions,
  getDefaultApiKeyModels,
  VoiceIDList,
} from '../storage/Constants.ts';
import CustomTextInput from './CustomTextInput.tsx';
import { requestAllOllamaModels } from '../api/ollama-api.ts';
import TabButton from './TabButton';
import { useAppContext } from '../history/AppProvider.tsx';
import { useTheme, ColorScheme } from '../theme';
import { requestAllModelsByBedrockAPI } from '../api/bedrock-api-key.ts';
import OpenAICompatConfigsSection from './OpenAICompatConfigsSection.tsx';

const initUpgradeInfo: UpgradeInfo = {
  needUpgrade: false,
  version: '',
  url: '',
};

export const GITHUB_LINK = 'https://github.com/aws-samples/swift-chat';

function SettingsScreen(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const allModel = getAllModels();
  const [apiUrl, setApiUrl] = useState(getApiUrl);
  const [apiKey, setApiKey] = useState(getApiKey);
  const [ollamaApiUrl, setOllamaApiUrl] = useState(getOllamaApiUrl);
  const [ollamaApiKey, setOllamaApiKey] = useState(getOllamaApiKey);
  const [deepSeekApiKey, setDeepSeekApiKey] = useState(getDeepSeekApiKey);
  const [openAIApiKey, setOpenAIApiKey] = useState(getOpenAIApiKey);
  const [openAIProxyEnabled, setOpenAIProxyEnabled] = useState(
    getOpenAIProxyEnabled
  );
  const [openAICompatConfigs, setOpenAICompatConfigs] = useState<
    OpenAICompatConfig[]
  >(getOpenAICompatConfigs);
  const [region, setRegion] = useState(getRegion);
  const [imageSize, setImageSize] = useState(getImageSize);
  const [hapticEnabled, setHapticEnabled] = useState(getHapticEnabled);
  const navigation = useNavigation<NavigationProp<RouteParamList>>();
  const [textModels, setTextModels] = useState<Model[]>(allModel.textModel);
  const [selectedTextModel, setSelectedTextModel] =
    useState<Model>(getTextModel);
  const [imageModels, setImageModels] = useState<Model[]>(allModel.imageModel);
  const [selectedImageModel, setSelectedImageModel] = useState<string>(
    getImageModel().modelId
  );
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo>(initUpgradeInfo);
  const [cost, setCost] = useState('0.00');
  const controllerRef = useRef<AbortController | null>(null);
  const [selectedTab, setSelectedTab] = useState('bedrock');
  const [thinkingEnabled, setThinkingEnabled] = useState(getThinkingEnabled);
  const [voiceId, setVoiceId] = useState(getVoiceId);
  const [bedrockConfigMode, setBedrockConfigMode] =
    useState(getBedrockConfigMode);
  const [bedrockApiKey, setBedrockApiKey] = useState(getBedrockApiKey);
  const [tavilyApiKey, setTavilyApiKey] = useState(getTavilyApiKey);
  const { sendEvent } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const openAICompatConfigsRef = useRef(openAICompatConfigs);
  const bedrockConfigModeRef = useRef(bedrockConfigMode);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearCountdown, setClearCountdown] = useState(10);
  const [isClearing, setIsClearing] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle OpenAI Compatible configs change
  const handleOpenAICompatConfigsChange = useCallback(
    (configs: OpenAICompatConfig[]) => {
      setOpenAICompatConfigs(configs);
    },
    []
  );

  const fetchAndSetModelNames = useCallback(
    async (shouldFetchOllama = false, shouldFetchBedrock = false) => {
      controllerRef.current = new AbortController();

      // Get Ollama models
      let ollamaModels: Model[] = [];
      if (shouldFetchOllama && getOllamaApiUrl().length > 0) {
        ollamaModels = await requestAllOllamaModels();
      } else if (!shouldFetchOllama) {
        // Filter existing Ollama models from current textModels
        ollamaModels = textModels.filter(
          model => model.modelTag === ModelTag.Ollama
        );
      }

      // Get Bedrock models
      let bedrockResponse = {
        textModel: [] as Model[],
        imageModel: [] as Model[],
      };
      if (shouldFetchBedrock) {
        bedrockResponse =
          bedrockConfigModeRef.current === 'bedrock'
            ? await requestAllModelsByBedrockAPI()
            : await requestAllModels();
        addBedrockPrefixToDeepseekModels(bedrockResponse.textModel);
        if (Platform.OS === 'android') {
          bedrockResponse.textModel = bedrockResponse.textModel.filter(
            model => model.modelName !== 'Nova Sonic'
          );
        }
      } else {
        // Filter existing Bedrock models from current models
        bedrockResponse.textModel = textModels.filter(
          model => !model.modelTag || model.modelTag === ModelTag.Bedrock
        );
        bedrockResponse.imageModel = imageModels;
      }

      // Handle image models
      if (bedrockResponse.imageModel.length > 0) {
        setImageModels(bedrockResponse.imageModel);
        const imageModel = getImageModel();
        const targetModels = bedrockResponse.imageModel.filter(
          model => model.modelName === imageModel.modelName
        );
        if (targetModels && targetModels.length === 1) {
          setSelectedImageModel(targetModels[0].modelId);
          saveImageModel(targetModels[0]);
        } else {
          setSelectedImageModel(bedrockResponse.imageModel[0].modelId);
          saveImageModel(bedrockResponse.imageModel[0]);
        }
      }

      // Generate OpenAI Compatible models
      const openAICompatModelList = generateOpenAICompatModels(
        openAICompatConfigsRef.current
      );

      // Combine all text models
      const allTextModels =
        bedrockResponse.textModel.length === 0
          ? [
              ...DefaultTextModel,
              ...ollamaModels,
              ...getDefaultApiKeyModels(),
              ...openAICompatModelList,
            ]
          : [
              ...bedrockResponse.textModel,
              ...ollamaModels,
              ...getDefaultApiKeyModels(),
              ...openAICompatModelList,
            ];

      setTextModels(allTextModels);

      // Update selected text model
      const textModel = getTextModel();
      const targetModels = allTextModels.filter(
        model => model.modelName === textModel.modelName
      );
      if (targetModels && targetModels.length === 1) {
        setSelectedTextModel(targetModels[0]);
        saveTextModel(targetModels[0]);
        updateTextModelUsageOrder(targetModels[0]);
      } else {
        const defaultMissMatchModel = allTextModels.filter(
          model => model.modelName === 'Claude 3 Sonnet'
        );
        if (defaultMissMatchModel && defaultMissMatchModel.length === 1) {
          setSelectedTextModel(defaultMissMatchModel[0]);
          saveTextModel(defaultMissMatchModel[0]);
          updateTextModelUsageOrder(defaultMissMatchModel[0]);
        }
      }

      sendEventRef.current('modelChanged');
      if (bedrockResponse.imageModel.length > 0 || allTextModels.length > 0) {
        saveAllModels({
          textModel: allTextModels,
          imageModel: bedrockResponse.imageModel,
        });
      }
    },
    [textModels, imageModels]
  );

  const fetchAndSetModelNamesRef = useRef(fetchAndSetModelNames);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      setCost(getTotalCost(getModelUsage()).toString());
      fetchAndSetModelNamesRef.current(true, true).then();
    });
  }, [navigation]);

  const toggleHapticFeedback = (value: boolean) => {
    setHapticEnabled(value);
    setHapticFeedbackEnabled(value);
    if (value && Platform.OS === 'android') {
      trigger(HapticFeedbackTypes.impactMedium);
    }
  };

  const handleCheckUpgrade = async () => {
    if ((isMac || Platform.OS === 'android') && upgradeInfo.needUpgrade) {
      await Linking.openURL(upgradeInfo.url);
    } else {
      await Linking.openURL(GITHUB_LINK + '/releases');
    }
  };

  useEffect(() => {
    if (apiUrl === getApiUrl() && apiKey === getApiKey()) {
      return;
    }
    saveKeys(apiUrl.trim(), apiKey.trim());
    fetchAndSetModelNamesRef.current(false, true).then();
    fetchUpgradeInfo().then();
  }, [apiUrl, apiKey]);

  useEffect(() => {
    if (ollamaApiUrl === getOllamaApiUrl()) {
      return;
    }
    saveOllamaApiURL(ollamaApiUrl.trim());
    fetchAndSetModelNamesRef.current(true, false).then();
  }, [ollamaApiUrl]);

  useEffect(() => {
    if (ollamaApiKey === getOllamaApiKey()) {
      return;
    }
    saveOllamaApiKey(ollamaApiKey.trim());
    fetchAndSetModelNamesRef.current(true, false).then();
  }, [ollamaApiKey]);

  useEffect(() => {
    if (deepSeekApiKey === getDeepSeekApiKey()) {
      return;
    }
    saveDeepSeekApiKey(deepSeekApiKey.trim());
    fetchAndSetModelNamesRef.current(false, false).then();
  }, [deepSeekApiKey]);

  useEffect(() => {
    if (openAIApiKey === getOpenAIApiKey()) {
      return;
    }
    saveOpenAIApiKey(openAIApiKey.trim());
    fetchAndSetModelNamesRef.current(false, false).then();
  }, [openAIApiKey]);

  useEffect(() => {
    const currentConfigs = openAICompatConfigsRef.current;
    if (
      JSON.stringify(openAICompatConfigs) === JSON.stringify(currentConfigs)
    ) {
      return;
    }
    openAICompatConfigsRef.current = openAICompatConfigs;
    fetchAndSetModelNamesRef.current(false, false).then();
  }, [openAICompatConfigs]);

  useEffect(() => {
    bedrockConfigModeRef.current = bedrockConfigMode;
    if (bedrockConfigMode === getBedrockConfigMode()) {
      return;
    }
    saveBedrockConfigMode(bedrockConfigMode);
    fetchAndSetModelNamesRef.current(false, true).then();
  }, [bedrockConfigMode]);

  useEffect(() => {
    if (bedrockApiKey === getBedrockApiKey()) {
      return;
    }
    saveBedrockApiKey(bedrockApiKey.trim());
    fetchAndSetModelNamesRef.current(false, true).then();
  }, [bedrockApiKey]);

  const fetchUpgradeInfo = async () => {
    if (isMac || Platform.OS === 'android') {
      const os = isMac ? 'mac' : 'android';
      const version = packageJson.version;
      const response = await requestUpgradeInfo(os, version);
      if (response.needUpgrade) {
        setUpgradeInfo(response);
      }
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={async () => {
            navigation.navigate('Bedrock', {
              sessionId: -1,
              tapIndex: -1,
            });
          }}
          imageSource={
            isDark
              ? require('../assets/done_dark.png')
              : require('../assets/done.png')
          }
        />
      ),
    });
  }, [apiUrl, apiKey, region, navigation, isDark]);

  const regionsData: DropdownItem[] = getAllRegions().map(regionId => ({
    label: regionId ?? '',
    value: regionId ?? '',
  }));
  const textModelsData: DropdownItem[] = textModels.map(model => ({
    label: model.modelName ?? '',
    value: model.modelName ?? '',
  }));
  const imageModelsData: DropdownItem[] = imageModels.map(model => ({
    label: model.modelName ?? '',
    value: model.modelId ?? '',
  }));
  const imageSizesData: DropdownItem[] = getAllImageSize(
    selectedImageModel
  ).map(size => ({
    label: size,
    value: size,
  }));
  const voiceIDData: DropdownItem[] = VoiceIDList.map(voice => ({
    label: voice.voiceName,
    value: voice.voiceId,
  }));

  const toggleOpenAIProxy = (value: boolean) => {
    setOpenAIProxyEnabled(value);
    saveOpenAIProxyEnabled(value);
  };

  const toggleThinking = (value: boolean) => {
    setThinkingEnabled(value);
    saveThinkingEnabled(value);
  };

  const handleOpenClearDialog = () => {
    setShowClearDialog(true);
    setClearCountdown(10);
    countdownIntervalRef.current = setInterval(() => {
      setClearCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCloseClearDialog = () => {
    setShowClearDialog(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setClearCountdown(10);
  };

  const handleClearAllData = async () => {
    if (clearCountdown > 0) {
      return;
    }
    setIsClearing(true);
    try {
      // Clear all chat history from storage
      clearAllChatHistory();

      // Delete all files in DocumentDirectoryPath
      const documentPath = RNFS.DocumentDirectoryPath;
      const files = await RNFS.readDir(documentPath);
      for (const file of files) {
        // Skip system files and directories that shouldn't be deleted
        if (
          file.name.startsWith('.') ||
          file.name === 'mmkv' ||
          file.name === 'RCTAsyncLocalStorage' ||
          file.name === 'RCTAsyncLocalStorage_V1'
        ) {
          continue;
        }
        try {
          if (file.isDirectory()) {
            await RNFS.unlink(file.path);
          } else {
            await RNFS.unlink(file.path);
          }
        } catch (e) {
          console.warn('Failed to delete file:', file.path, e);
        }
      }

      sendEvent('historyChanged');
      handleCloseClearDialog();
    } catch (error) {
      console.error('Error clearing data:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const renderProviderSettings = () => {
    switch (selectedTab) {
      case 'bedrock':
        return (
          <>
            <View style={styles.configSwitchContainer}>
              <TouchableOpacity
                style={[
                  styles.configSwitchButton,
                  bedrockConfigMode === 'bedrock' &&
                    styles.configSwitchButtonActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setBedrockConfigMode('bedrock')}>
                <Text
                  style={[
                    styles.configSwitchText,
                    bedrockConfigMode === 'bedrock' &&
                      styles.configSwitchTextActive,
                  ]}>
                  Bedrock API Key
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.configSwitchButton,
                  bedrockConfigMode === 'swiftchat' &&
                    styles.configSwitchButtonActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setBedrockConfigMode('swiftchat')}>
                <Text
                  style={[
                    styles.configSwitchText,
                    bedrockConfigMode === 'swiftchat' &&
                      styles.configSwitchTextActive,
                  ]}>
                  SwiftChat Server
                </Text>
              </TouchableOpacity>
            </View>
            {bedrockConfigMode === 'bedrock' ? (
              <>
                <CustomTextInput
                  label="Bedrock API Key"
                  value={bedrockApiKey}
                  onChangeText={setBedrockApiKey}
                  placeholder="Enter Bedrock API Key"
                  secureTextEntry={true}
                />
              </>
            ) : (
              <>
                <CustomTextInput
                  label="API URL"
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="Enter API URL"
                />
                <CustomTextInput
                  label="API Key"
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Enter API Key"
                  secureTextEntry={true}
                />
              </>
            )}
            <CustomDropdown
              label="Region"
              data={regionsData}
              value={region}
              onChange={(item: DropdownItem) => {
                if (item.value !== '' && item.value !== region) {
                  setRegion(item.value);
                  saveRegion(item.value);
                  fetchAndSetModelNames(false, true).then();
                }
              }}
              placeholder="Select a region"
            />
          </>
        );
      case 'ollama':
        return (
          <>
            <CustomTextInput
              label="Ollama API URL"
              value={ollamaApiUrl}
              onChangeText={setOllamaApiUrl}
              placeholder="Enter Ollama API URL"
            />
            <CustomTextInput
              label="Ollama API Key"
              value={ollamaApiKey}
              onChangeText={setOllamaApiKey}
              placeholder="Enter Ollama API Key (Optional)"
              secureTextEntry={true}
            />
          </>
        );
      case 'deepseek':
        return (
          <CustomTextInput
            label="DeepSeek API Key"
            value={deepSeekApiKey}
            onChangeText={setDeepSeekApiKey}
            placeholder="Enter Deep Seek API Key"
            secureTextEntry={true}
          />
        );
      case 'openai':
        return (
          <>
            <CustomTextInput
              label="OpenAI API Key"
              value={openAIApiKey}
              onChangeText={setOpenAIApiKey}
              placeholder="Enter OpenAI API Key"
              secureTextEntry={true}
            />
            <OpenAICompatConfigsSection
              isDark={isDark}
              onConfigsChange={handleOpenAICompatConfigsChange}
            />
            {apiKey.length > 0 && apiUrl.length > 0 && (
              <View style={styles.proxySwitchContainer}>
                <Text style={styles.proxyLabel}>Use Proxy</Text>
                <Switch
                  style={[isMac ? styles.switch : {}]}
                  value={openAIProxyEnabled}
                  onValueChange={toggleOpenAIProxy}
                />
              </View>
            )}
          </>
        );
      default:
        return null;
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView style={styles.container}>
        <View style={styles.providerSettingsWrapper}>
          <View style={styles.tabContainer}>
            <TabButton
              label={isMac ? 'Amazon Bedrock' : 'Bedrock'}
              isSelected={selectedTab === 'bedrock'}
              onPress={() => setSelectedTab('bedrock')}
            />
            <TabButton
              label="Ollama"
              isSelected={selectedTab === 'ollama'}
              onPress={() => setSelectedTab('ollama')}
            />
            <TabButton
              label="DeepSeek"
              isSelected={selectedTab === 'deepseek'}
              onPress={() => setSelectedTab('deepseek')}
            />
            <TabButton
              label="OpenAI"
              isSelected={selectedTab === 'openai'}
              onPress={() => setSelectedTab('openai')}
            />
          </View>

          <View style={styles.providerSettingsContainer}>
            {renderProviderSettings()}
          </View>
        </View>

        <Text style={[styles.label, styles.middleLabel]}>Select Model</Text>
        <CustomDropdown
          label="Chat Model"
          data={textModelsData}
          value={selectedTextModel.modelName}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              const selectedModel = textModels.find(
                model => model.modelName === item.value
              );
              if (selectedModel) {
                saveTextModel(selectedModel);
                setSelectedTextModel(selectedModel!);
                updateTextModelUsageOrder(selectedModel);
                sendEvent('modelChanged');
              }
            }
          }}
          placeholder="Select a model"
        />
        {selectedTextModel &&
          BedrockThinkingModels.includes(selectedTextModel.modelName) && (
            <View style={styles.thinkingSwitchContainer}>
              <Text style={styles.proxyLabel}>Enable Thinking</Text>
              <Switch
                style={[isMac ? styles.switch : {}]}
                value={thinkingEnabled}
                onValueChange={toggleThinking}
              />
            </View>
          )}

        {selectedTextModel &&
          BedrockVoiceModels.includes(selectedTextModel.modelName) && (
            <CustomDropdown
              label="Voice ID"
              data={voiceIDData}
              value={voiceId}
              onChange={(item: DropdownItem) => {
                if (item.value !== '') {
                  setVoiceId(item.value);
                  saveVoiceId(item.value);
                }
              }}
              placeholder="Select Voice ID"
            />
          )}

        <CustomDropdown
          label="Image Model"
          data={imageModelsData}
          value={selectedImageModel}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              setSelectedImageModel(item.value);
              const selectedModel = imageModels.find(
                model => model.modelId === item.value
              );
              if (selectedModel) {
                saveImageModel(selectedModel);
                if (isNewStabilityImageModel(item.value)) {
                  setImageSize('1024 x 1024');
                  saveImageSize('1024 x 1024');
                }
              }
            }
          }}
          placeholder="Select a model"
        />
        <CustomDropdown
          label="Image Size"
          data={imageSizesData}
          value={imageSize}
          onChange={(item: DropdownItem) => {
            if (item.value !== '') {
              setImageSize(item.value);
              saveImageSize(item.value);
            }
          }}
          placeholder="Select image size"
        />

        <Text style={[styles.label, styles.middleLabel]}>Web Search</Text>

        <CustomTextInput
          label="Tavily API Key"
          value={tavilyApiKey}
          onChangeText={text => {
            setTavilyApiKey(text);
            saveTavilyApiKey(text);
          }}
          placeholder="Enter Tavily API Key"
          secureTextEntry={true}
        />
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() => navigation.navigate('TokenUsage', {})}>
          <Text style={styles.label}>Usage</Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.text}>{`USD ${cost}`}</Text>
            <Image
              style={styles.arrowImage}
              source={
                isDark
                  ? require('../assets/back_dark.png')
                  : require('../assets/back.png')
              }
            />
          </View>
        </TouchableOpacity>
        {!isMac && (
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Haptic Feedback</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={toggleHapticFeedback}
            />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() => Linking.openURL(GITHUB_LINK)}>
          <Text style={styles.label}>Configuration Guide</Text>
          <Image
            style={styles.arrowImage}
            source={
              isDark
                ? require('../assets/back_dark.png')
                : require('../assets/back.png')
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() =>
            Linking.openURL(GITHUB_LINK + '/discussions/new?category=general')
          }>
          <Text style={styles.label}>Submit Feedback</Text>
          <Image
            style={styles.arrowImage}
            source={
              isDark
                ? require('../assets/back_dark.png')
                : require('../assets/back.png')
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.itemContainer}
          onPress={() =>
            Linking.openURL(
              GITHUB_LINK + '/issues/new?template=bug_report.yaml'
            )
          }>
          <Text style={styles.label}>Report an Issue</Text>
          <Image
            style={styles.arrowImage}
            source={
              isDark
                ? require('../assets/back_dark.png')
                : require('../assets/back.png')
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemContainer}
          activeOpacity={1}
          onPress={handleCheckUpgrade}>
          <Text style={styles.label}>App Version</Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.text}>
              {packageJson.version +
                (Platform.OS === 'ios' && getBuildNumber()
                  ? ` (${getBuildNumber()})`
                  : '') +
                (upgradeInfo.needUpgrade ? ` → ${upgradeInfo.version}` : '')}
            </Text>
            <Image
              style={styles.arrowImage}
              source={
                isDark
                  ? require('../assets/back_dark.png')
                  : require('../assets/back.png')
              }
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clearDataButton}
          activeOpacity={0.7}
          onPress={handleOpenClearDialog}>
          <Text style={styles.clearDataButtonText}>Clear All Chat History</Text>
        </TouchableOpacity>
      </ScrollView>
      <Dialog.Container visible={showClearDialog}>
        <Dialog.Title>Clear All Data</Dialog.Title>
        <Dialog.Description>
          This will delete all chat history and saved files. This action cannot
          be undone.
          {clearCountdown > 0
            ? `\n\nPlease wait ${clearCountdown} seconds to confirm.`
            : '\n\nYou can now confirm the deletion.'}
        </Dialog.Description>
        <Dialog.Button label="Cancel" onPress={handleCloseClearDialog} />
        <Dialog.Button
          label={isClearing ? 'Clearing...' : 'Confirm'}
          onPress={handleClearAllData}
          disabled={clearCountdown > 0 || isClearing}
          color={clearCountdown > 0 ? '#999' : '#FF3B30'}
        />
      </Dialog.Container>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      padding: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    firstLabel: {
      marginBottom: 12,
    },
    middleLabel: {
      marginTop: 10,
      marginBottom: 12,
    },
    proxyLabel: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textDarkGray,
      marginLeft: 2,
    },
    text: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    input: {
      height: 40,
      borderColor: colors.inputBorder,
      borderWidth: 1,
      borderRadius: 6,
      marginBottom: 16,
      marginTop: 8,
      paddingHorizontal: 10,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    proxySwitchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    thinkingSwitchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    itemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    arrowContainer: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    arrowImage: {
      width: 16,
      height: 16,
      transform: [{ scaleX: -1 }],
      opacity: 0.6,
      marginLeft: 4,
    },
    versionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 10,
      paddingBottom: 60,
    },
    clearDataButton: {
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 80,
    },
    clearDataButtonText: {
      color: '#FF3B30',
      fontSize: 16,
      fontWeight: '600',
    },
    apiKeyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    apiKeyInputContainer: {
      flex: 1,
      marginRight: 10,
    },
    proxyContainer: {
      marginBottom: 12,
    },
    proxyMacContainer: {
      marginTop: 10,
    },
    providerSettingsWrapper: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 2,
      marginBottom: 12,
    },
    tabContainer: {
      flexDirection: 'row',
      marginBottom: 12,
      marginHorizontal: Platform.OS === 'ios' ? -2 : 0,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 6,
    },
    providerSettingsContainer: {
      paddingHorizontal: 2,
    },
    switch: {
      marginRight: -14,
      width: 32,
      height: 32,
    },
    configSwitchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
    },
    configSwitchButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      margin: 2,
    },
    configSwitchButtonActive: {
      backgroundColor: colors.text + 'CC',
    },
    configSwitchText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    configSwitchTextActive: {
      color: colors.background,
      fontWeight: '600',
    },
  });

export default SettingsScreen;
