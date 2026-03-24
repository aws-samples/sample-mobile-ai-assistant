import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import { Platform } from 'react-native';
import {
  getHapticEnabled,
  saveHapticEnabled,
} from '../storage/StorageUtils.ts';
import { isMac } from '../App.tsx';

let hapticFeedbackEnabled = getHapticEnabled();

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

export function setHapticFeedbackEnabled(isEnabled: boolean) {
  hapticFeedbackEnabled = isEnabled;
  saveHapticEnabled(isEnabled);
}

export function trigger(method: HapticFeedbackTypes) {
  if (isMac || !hapticFeedbackEnabled) {
    return;
  }
  if (method === HapticFeedbackTypes.selection && Platform.OS === 'android') {
    method = HapticFeedbackTypes.soft;
  }
  ReactNativeHapticFeedback.trigger(method, hapticOptions);
}
