import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { ColorScheme, useTheme } from '../theme';

export type ScanResult = { apiUrl: string; apiKey: string };

export type ScanQRSheetRef = {
  present: () => void;
  dismiss: () => void;
};

interface Props {
  onScanned: (result: ScanResult) => void;
}

const ScanQRSheet = forwardRef<ScanQRSheetRef, Props>(({ onScanned }, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const snapPoints = useMemo(() => ['90%'], []);
  const isFocused = useIsFocused();

  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'unknown'
  >('unknown');
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  const device = useCameraDevice('back');

  React.useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleScanned = useCallback(
    (value: string) => {
      if (scannedRef.current) return;
      try {
        const parsed = JSON.parse(value);
        if (
          parsed &&
          typeof parsed.apiUrl === 'string' &&
          typeof parsed.apiKey === 'string' &&
          parsed.apiUrl.length > 0 &&
          parsed.apiKey.length > 0
        ) {
          scannedRef.current = true;
          ReactNativeHapticFeedback.trigger('notificationSuccess', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          onScanned({ apiUrl: parsed.apiUrl, apiKey: parsed.apiKey });
          sheetRef.current?.dismiss();
        } else {
          setError('Invalid QR code format');
        }
      } catch {
        setError('QR code is not valid JSON');
      }
    },
    [onScanned]
  );

  // Auto-dismiss the error banner after 3 seconds so a bad scan does not
  // linger on screen forever.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const value = codes[0]?.value;
      if (value) handleScanned(value);
    },
  });

  const handleSheetChange = useCallback((index: number) => {
    const opened = index >= 0;
    setIsOpen(opened);
    if (!opened) {
      scannedRef.current = false;
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      let status = Camera.getCameraPermissionStatus();
      if (status !== 'granted') {
        // Trigger system prompt. On Android the returned value can briefly lag
        // behind the actual grant, so re-read the status afterwards.
        await Camera.requestCameraPermission();
        status = Camera.getCameraPermissionStatus();
      }
      setPermission(status === 'granted' ? 'granted' : 'denied');
    })();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const cameraActive = isOpen && isFocused && permission === 'granted';

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}>
      <View style={styles.content}>
        <View style={styles.cameraWrapper}>
          {permission === 'denied' ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Camera permission denied</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Linking.openSettings()}>
                <Text style={styles.linkText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : permission !== 'granted' || !device ? (
            <View style={styles.center}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.hintText}>Initializing camera...</Text>
            </View>
          ) : (
            <Camera
              style={styles.camera}
              device={device}
              isActive={cameraActive}
              codeScanner={codeScanner}
            />
          )}
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.overlayTitle}>Scan QR Code</Text>
            <Text style={styles.overlaySubtitle}>
              Point the camera at the QR code printed by install.sh
            </Text>
          </View>
          {error ? (
            <View style={styles.errorBanner} pointerEvents="none">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </BottomSheetModal>
  );
});

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: '#000000',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    handle: {
      backgroundColor: 'transparent',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    handleIndicator: {
      backgroundColor: 'rgba(255,255,255,0.6)',
    },
    content: {
      flex: 1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    cameraWrapper: {
      flex: 1,
      backgroundColor: '#000000',
      overflow: 'hidden',
    },
    camera: {
      flex: 1,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 20,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    overlayTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 4,
    },
    overlaySubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    errorBanner: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 40,
      padding: 12,
      borderRadius: 8,
      backgroundColor: 'rgba(229, 57, 53, 0.9)',
    },
    errorText: {
      color: '#FFFFFF',
      fontSize: 14,
      textAlign: 'center',
    },
    hintText: {
      color: '#FFFFFF',
      marginTop: 12,
    },
    linkButton: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    linkText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
      textDecorationLine: 'underline',
    },
  });

export default ScanQRSheet;
