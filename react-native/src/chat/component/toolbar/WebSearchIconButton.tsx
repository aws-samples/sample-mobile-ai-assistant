import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import {
  getSearchProvider,
  saveSearchProvider,
} from '../../../storage/StorageUtils';
import { getSearchProviderIcon } from '../../../websearch/SearchIconUtils';
import { useTheme } from '../../../theme';
import { useAppContext } from '../../../history/AppProvider';
import { SearchEngineOption } from '../../../websearch/types';

interface WebSearchIconButtonProps {
  onPress: () => void;
}

export const WebSearchIconButton: React.FC<WebSearchIconButtonProps> = ({
  onPress,
}) => {
  const { isDark } = useTheme();
  const { sendEvent } = useAppContext();
  const searchProvider = getSearchProvider();
  const searchIcon = getSearchProviderIcon(
    searchProvider as SearchEngineOption,
    isDark
  );

  const handlePress = () => {
    // If current provider is not disabled (google/bing/baidu/tavily), toggle to disabled
    if (searchProvider !== 'disabled') {
      saveSearchProvider('disabled');
      sendEvent('searchProviderChanged');
    } else {
      // If disabled, show modal to select a provider
      onPress();
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Image source={searchIcon} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 30,
    height: 30,
    marginBottom: -6,
  },
});
