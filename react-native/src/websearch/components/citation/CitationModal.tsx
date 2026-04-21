import React, { useMemo, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Animated,
  Image,
} from 'react-native';
import { Citation } from '../../../types/Chat';
import { useTheme, ColorScheme } from '../../../theme';
import { trigger } from '../../../core/HapticUtils';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types';
import { getFaviconUrl } from '../../FaviconUtils';

interface CitationModalProps {
  visible: boolean;
  citations: Citation[];
  onClose: () => void;
}

const CitationModal: React.FC<CitationModalProps> = ({
  visible,
  citations,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = React.useState(visible);

  // Memoize favicon URLs to prevent re-fetching on every render
  const citationsWithFavicons = useMemo(() => {
    return citations.map(citation => ({
      ...citation,
      faviconUrl: getFaviconUrl(citation.url),
    }));
  }, [citations]);

  useEffect(() => {
    if (visible) {
      // Show modal immediately
      setModalVisible(true);

      // Reset to initial position first
      slideAnim.setValue(300);
      fadeAnim.setValue(0);

      // Show overlay immediately and slide content up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      // Fade out and slide down
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide modal after animation completes
        setModalVisible(false);
      });
    }
  }, [visible, fadeAnim, slideAnim, modalVisible]);

  const handleOpenUrl = (url: string) => {
    trigger(HapticFeedbackTypes.impactLight);
    Linking.openURL(url).catch(err => {
      console.log('Failed to open URL:', err);
    });
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>References</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}>
            {citationsWithFavicons.length === 0 && (
              <Text style={styles.emptyText}>No citations available</Text>
            )}
            {citationsWithFavicons.map((citation, index) => (
              <TouchableOpacity
                key={index}
                style={styles.citationItem}
                activeOpacity={0.7}
                onPress={() => handleOpenUrl(citation.url)}>
                <View style={styles.citationHeader}>
                  <View style={styles.citationNumberBadge}>
                    {citation.faviconUrl ? (
                      <Image
                        source={{ uri: citation.faviconUrl }}
                        style={styles.faviconImage}
                        defaultSource={require('../../../assets/link.png')}
                      />
                    ) : (
                      <Text style={styles.citationNumberText}>
                        {citation.number}
                      </Text>
                    )}
                  </View>
                  <View style={styles.citationContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.citationTitle} numberOfLines={2}>
                        {citation.title}
                      </Text>
                      <View style={styles.citationNumberCircle}>
                        <Text style={styles.citationNumberInTitle}>
                          {citation.number}
                        </Text>
                      </View>
                    </View>
                    {citation.excerpt && (
                      <Text style={styles.citationExcerpt} numberOfLines={3}>
                        {citation.excerpt}
                      </Text>
                    )}
                    <Text style={styles.citationUrl} numberOfLines={1}>
                      {citation.url}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    overlayTouchable: {
      flex: 1,
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    closeText: {
      fontSize: 20,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    scrollView: {
      maxHeight: 500,
    },
    emptyText: {
      padding: 20,
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 14,
    },
    citationItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.citationBorder,
    },
    citationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    citationNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.citationBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    citationNumberText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.citationText,
    },
    faviconImage: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    citationContent: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    faviconPlaceholder: {
      fontSize: 14,
      marginRight: 6,
    },
    citationTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 20,
      marginRight: 8,
    },
    citationNumberCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.textSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    citationNumberInTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.background,
    },
    citationExcerpt: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 6,
    },
    citationUrl: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
  });

export default CitationModal;
