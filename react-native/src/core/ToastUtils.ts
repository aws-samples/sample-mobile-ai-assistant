import Toast from 'react-native-toast-message';

export const showInfo = (msg: string) => {
  Toast.show({
    type: 'info',
    text1: msg,
    position: 'bottom',
    visibilityTime: 1500,
  });
};
