import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { OpenAICompatConfig } from '../types/Chat.ts';
import {
  getOpenAICompatConfigs,
  saveOpenAICompatConfigs,
} from '../storage/StorageUtils.ts';
import { useTheme, ColorScheme } from '../theme';
import OpenAICompatConfigComponent from './OpenAICompatConfigComponent.tsx';
import { v4 as uuidv4 } from 'uuid';
import Dialog from 'react-native-dialog';
import { showInfo } from '../chat/util/ToastUtils.ts';

interface OpenAICompatConfigsSectionProps {
  isDark: boolean;
  onConfigsChange: (configs: OpenAICompatConfig[]) => void;
}

export default function OpenAICompatConfigsSection({
  isDark,
  onConfigsChange,
}: OpenAICompatConfigsSectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [configs, setConfigs] = useState<OpenAICompatConfig[]>([]);
  const onConfigsChangeRef = useRef(onConfigsChange);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const deleteIdRef = useRef('');

  // Update ref when onConfigsChange changes
  useEffect(() => {
    onConfigsChangeRef.current = onConfigsChange;
  });

  // Initialize OpenAI Compatible configs on mount
  useEffect(() => {
    const initializeConfigs = () => {
      let initialConfigs = getOpenAICompatConfigs();

      // Ensure at least one config exists
      if (initialConfigs.length === 0) {
        const defaultConfig: OpenAICompatConfig = {
          id: uuidv4(),
          baseUrl: '',
          apiKey: '',
          modelIds: '',
        };
        initialConfigs = [defaultConfig];
        saveOpenAICompatConfigs(initialConfigs);
      }

      setConfigs(initialConfigs);
      onConfigsChangeRef.current(initialConfigs);
    };

    initializeConfigs();
  }, []); // Only run once on mount

  // Add new OpenAI Compatible config
  const addOpenAICompatConfig = () => {
    if (configs.length < 10) {
      const newConfig: OpenAICompatConfig = {
        id: uuidv4(),
        baseUrl: '',
        apiKey: '',
        modelIds: '',
      };
      const updatedConfigs = [...configs, newConfig];
      setConfigs(updatedConfigs);
      saveOpenAICompatConfigs(updatedConfigs);
      onConfigsChangeRef.current(updatedConfigs);
    } else {
      showInfo('A maximum of 10 OpenAI Compatible items can be added.');
    }
  };

  // Update OpenAI Compatible config
  const updateOpenAICompatConfig = (
    id: string,
    field: keyof OpenAICompatConfig,
    value: string
  ) => {
    const updatedConfigs = configs.map(config =>
      config.id === id ? { ...config, [field]: value } : config
    );
    setConfigs(updatedConfigs);
    saveOpenAICompatConfigs(updatedConfigs);
    onConfigsChangeRef.current(updatedConfigs);
  };

  // Remove OpenAI Compatible config
  const removeOpenAICompatConfig = (id: string) => {
    const updatedConfigs = configs.filter(config => config.id !== id);
    setConfigs(updatedConfigs);
    saveOpenAICompatConfigs(updatedConfigs);
    onConfigsChangeRef.current(updatedConfigs);
  };
  const columnIndex =
    configs.findIndex(config => config.id === deleteIdRef.current) + 1;

  return (
    <View style={styles.openAICompatSection}>
      <View style={styles.openAICompatHeader}>
        <Text style={styles.label}>OpenAI Compatible</Text>
        <TouchableOpacity
          onPress={addOpenAICompatConfig}
          style={styles.addButton}>
          <Image
            style={styles.addIcon}
            source={
              isDark
                ? require('../assets/add_dark.png')
                : require('../assets/add.png')
            }
          />
        </TouchableOpacity>
      </View>
      {configs.map((config, index) => (
        <OpenAICompatConfigComponent
          key={config.id}
          config={config}
          index={index}
          isFirst={index === 0}
          onUpdate={updateOpenAICompatConfig}
          onRemove={id => {
            deleteIdRef.current = id;
            setShowDialog(true);
          }}
          isDark={isDark}
        />
      ))}
      <Dialog.Container visible={showDialog}>
        <Dialog.Title>
          Delete {'\n'}OpenAI Compatible {columnIndex}
        </Dialog.Title>
        <Dialog.Description>You cannot undo this action.</Dialog.Description>
        <Dialog.Button
          label="Cancel"
          onPress={() => {
            setShowDialog(false);
          }}
        />
        <Dialog.Button
          label="Delete"
          onPress={() => {
            removeOpenAICompatConfig(deleteIdRef.current);
            setShowDialog(false);
          }}
        />
      </Dialog.Container>
    </View>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    openAICompatSection: {
      marginTop: 12,
    },
    openAICompatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    addButton: {
      paddingVertical: 4,
    },
    addIcon: {
      width: 24,
      height: 24,
    },
  });
