import React, { useState, useCallback, useEffect } from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../theme';

interface CopyButtonProps {
  /** Function that returns the content to copy, or direct content string */
  content: string | (() => string);
}

const CopyButton: React.FC<CopyButtonProps> = React.memo(({ content }) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = typeof content === 'function' ? content() : content;
    Clipboard.setString(text);
    setCopied(true);
  }, [content]);

  const imageSource = copied
    ? isDark
      ? require('../../assets/done_dark.png')
      : require('../../assets/done.png')
    : isDark
    ? require('../../assets/copy_grey.png')
    : require('../../assets/copy.png');

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <TouchableOpacity style={styles.copyButtonLayout} onPress={handleCopy}>
      <Image source={imageSource} style={styles.copyButton} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  copyButtonLayout: {
    padding: 10,
    marginLeft: 'auto',
  },
  copyButton: {
    width: 18,
    height: 18,
  },
});

export default CopyButton;
