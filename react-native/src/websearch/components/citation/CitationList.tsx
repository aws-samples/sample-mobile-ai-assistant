import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Citation } from '../../../types/Chat';
import { useTheme, ColorScheme } from '../../../theme';
import { trigger } from '../../../core/HapticUtils';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types';
import CitationModal from './CitationModal';
import { getFaviconUrl } from '../../FaviconUtils';

interface CitationListProps {
  citations: Citation[];
}

const CitationList: React.FC<CitationListProps> = ({ citations }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);

  // Memoize favicon URLs to prevent re-fetching on every render
  const faviconUrls = useMemo(() => {
    return citations.slice(0, 4).map(citation => getFaviconUrl(citation.url));
  }, [citations]);

  if (!citations || citations.length === 0) {
    return null;
  }

  const handleOpenModal = () => {
    trigger(HapticFeedbackTypes.impactLight);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={handleOpenModal}>
        <View style={styles.iconsRow}>
          {faviconUrls.map((faviconUrl, index) => (
            <View
              key={index}
              style={[
                styles.faviconContainer,
                index > 0 && styles.faviconContainerOverlap,
              ]}>
              {faviconUrl ? (
                <Image
                  source={{ uri: faviconUrl }}
                  style={styles.faviconImage}
                  defaultSource={require('../../../assets/link.png')}
                />
              ) : (
                <View style={styles.faviconPlaceholder} />
              )}
            </View>
          ))}
          <Text style={styles.sourceCount}>
            {citations.length} website{citations.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>

      <CitationModal
        visible={modalVisible}
        citations={citations}
        onClose={handleCloseModal}
      />
    </>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.citationListBackground,
      borderRadius: 20,
      alignSelf: 'flex-start',
    },
    iconsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    faviconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.citationListBackground,
    },
    faviconContainerOverlap: {
      marginLeft: -8,
    },
    faviconImage: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    faviconPlaceholder: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.citationBorder,
    },
    sourceCount: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
      marginLeft: 8,
    },
  });

export default CitationList;
