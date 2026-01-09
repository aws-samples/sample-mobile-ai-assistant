import * as React from 'react';
import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getModelUsage } from '../storage/StorageUtils';
import { Usage } from '../types/Chat.ts';
import { useNavigation } from '@react-navigation/native';
import { RouteParamList } from '../types/RouteTypes.ts';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  getTotalCost,
  getTotalImageCount,
  getTotalImagePrice,
  getTotalInputPrice,
  getTotalInputTokens,
  getTotalOutputPrice,
  getTotalOutputTokens,
  getUsagePrice,
} from './ModelPrice.ts';
import { HeaderLeftView } from '../prompt/HeaderLeftView.tsx';
import { useTheme, ColorScheme } from '../theme';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

function TokenUsageScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const [modelUsage, setModelUsage] = React.useState<Usage[]>([]);
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation, isDark),
    [navigation, isDark]
  );
  React.useLayoutEffect(() => {
    const headerOption = {
      headerLeft,
    };
    navigation.setOptions(headerOption);
  }, [navigation, headerLeft]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return navigation.addListener('focus', () => {
      setModelUsage(getModelUsage());
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  }, [navigation, slideAnim]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {modelUsage
          .sort((a, b) => {
            const priceA = getUsagePrice(a).totalPrice;
            const priceB = getUsagePrice(b).totalPrice;
            if (priceA >= 0 && priceB >= 0) {
              return priceB - priceA;
            } else if (priceA < 0 && priceB < 0) {
              return priceA - priceB;
            } else {
              return priceA < 0 ? 1 : -1;
            }
          })
          .map((usage, index) => {
            const usagePrice = getUsagePrice(usage);
            const isImageModel =
              usage.imageCount ||
              usage.smallImageCount ||
              usage.largeImageCount;

            return (
              <View key={index} style={styles.usageItem}>
                <View style={styles.modelHeader}>
                  <Text style={styles.modelName}>{usage.modelName}</Text>
                  <Text style={styles.totalPrice}>
                    {usagePrice.totalPrice < 0
                      ? '--'
                      : usagePrice.totalPrice === 0
                      ? 'USD 0.00'
                      : `USD ${usagePrice.totalPrice}`}
                  </Text>
                </View>

                {isImageModel ? (
                  <>
                    {usage.smallImageCount ? (
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenText}>
                          512-Standard: {usage.smallImageCount.toLocaleString()}
                        </Text>
                        <Text style={styles.tokenText}>
                          USD {usagePrice.smallImagePrice}
                        </Text>
                      </View>
                    ) : null}
                    {usage.imageCount ? (
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenText}>
                          1024-Standard: {usage.imageCount.toLocaleString()}
                        </Text>
                        <Text style={styles.tokenText}>
                          USD {usagePrice.mediumImagePrice}
                        </Text>
                      </View>
                    ) : null}
                    {usage.largeImageCount ? (
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenText}>
                          2048-Standard:{' '}
                          {usage.largeImageCount.toLocaleString()}
                        </Text>
                        <Text style={styles.tokenText}>
                          USD {usagePrice.largeImagePrice}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={styles.tokenInfo}>
                      <Text style={styles.tokenText}>
                        Input: {usage.inputTokens.toLocaleString()}
                      </Text>
                      <Text style={styles.tokenText}>
                        {usagePrice.inputPrice < 0
                          ? '--'
                          : `USD ${usagePrice.inputPrice}`}
                      </Text>
                    </View>
                    <View style={styles.tokenInfo}>
                      <Text style={styles.tokenText}>
                        Output: {usage.outputTokens.toLocaleString()}
                      </Text>
                      <Text style={styles.tokenText}>
                        {usagePrice.outputPrice < 0
                          ? '--'
                          : `USD ${usagePrice.outputPrice}`}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        <View style={styles.totalContainer}>
          <View style={styles.totalHeader}>
            <Text style={styles.totalLabel}>Total Usage</Text>
            <Text style={styles.totalPrice}>
              USD {getTotalCost(modelUsage).toString()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>
              Input Tokens: {getTotalInputTokens(modelUsage).toLocaleString()}
            </Text>
            <Text style={styles.totalText}>
              USD {getTotalInputPrice(modelUsage).toString()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>
              Output Tokens: {getTotalOutputTokens(modelUsage).toLocaleString()}
            </Text>
            <Text style={styles.totalText}>
              USD {getTotalOutputPrice(modelUsage).toString()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>
              Images: {getTotalImageCount(modelUsage).toLocaleString()}
            </Text>
            <Text style={styles.totalText}>
              USD {getTotalImagePrice(modelUsage).toString()}
            </Text>
          </View>
        </View>
        <Text
          style={styles.firstPriceLink}
          onPress={() =>
            Linking.openURL('https://aws.amazon.com/bedrock/pricing/')
          }>
          * Amazon Bedrock model pricing is estimated based on US region rates.
          Actual costs may vary by region. For accurate pricing, please refer to{' '}
          <Text style={[styles.firstPriceLink, styles.underline]}>
            Amazon Bedrock Pricing
          </Text>
        </Text>
        <Text
          style={styles.priceLink}
          onPress={() =>
            Linking.openURL('https://api-docs.deepseek.com/quick_start/pricing')
          }>
          * For DeepSeek models, please refer to{' '}
          <Text style={[styles.priceLink, styles.underline]}>
            DeepSeek API Pricing
          </Text>
        </Text>
        <Text
          style={styles.priceLink}
          onPress={() => Linking.openURL('https://openai.com/api/pricing/')}>
          * For OpenAI models, please refer to{' '}
          <Text style={[styles.priceLink, styles.underline]}>
            OpenAI API Pricing
          </Text>
        </Text>
        <Text style={styles.priceLink}>
          * Currently, usage price calculation is not supported for Ollama and
          OpenAI Compatible models.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 60,
    },
    usageItem: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modelName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    tokenInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    tokenText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    totalContainer: {
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    totalText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    modelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    totalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    totalPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    pricingContainer: {
      marginTop: 16,
    },
    firstPriceLink: {
      marginTop: 16,
      fontSize: 12,
      color: colors.textSecondary,
      paddingVertical: 4,
      textAlign: 'left',
    },
    priceLink: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSecondary,
      paddingVertical: 4,
      textAlign: 'left',
    },
    underline: {
      textDecorationLine: 'underline',
    },
  });

export default TokenUsageScreen;
