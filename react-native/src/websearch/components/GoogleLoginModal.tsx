import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';

interface GoogleLoginModalProps {
  visible: boolean;
  onSkip: () => void;
  onDone: () => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  visible,
  onSkip,
  onDone,
}) => {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        container: {
          width: '90%',
          height: '80%',
          backgroundColor: colors.background,
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          backgroundColor: colors.border,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        },
        webViewContainer: {
          flex: 1,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        button: {
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          minWidth: 100,
          alignItems: 'center',
        },
        skipButton: {
          backgroundColor: colors.border,
        },
        doneButton: {
          backgroundColor: colors.primary,
        },
        skipButtonText: {
          fontSize: 15,
          fontWeight: '500',
          color: colors.text,
        },
        doneButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: '#fff',
        },
      }),
    [colors]
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sign in to Google</Text>
          </View>
          <View style={styles.webViewContainer}>
            <WebView
              source={{ uri: 'https://accounts.google.com' }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
            />
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={onSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.doneButton]}
              onPress={onDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
