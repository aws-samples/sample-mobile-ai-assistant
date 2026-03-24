import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { getTextModel } from '../../../storage/StorageUtils';
import { getModelIcon } from '../../../utils/ModelUtils.ts';
import { useTheme } from '../../../theme';

interface ModelIconButtonProps {
  onPress: () => void;
}

export const ModelIconButton: React.FC<ModelIconButtonProps> = ({
  onPress,
}) => {
  // Directly get the current model on each render
  const { isDark } = useTheme();
  const model = getTextModel();
  const modelIcon = getModelIcon(model.modelTag ?? '', model.modelId, isDark);
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image source={modelIcon} style={styles.icon} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 52,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 12,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: -6,
  },
});
