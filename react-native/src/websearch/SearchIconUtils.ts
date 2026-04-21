import { SearchEngineOption } from '../websearch/types';

export const getSearchProviderIcon = (
  provider: SearchEngineOption,
  isDark: boolean
) => {
  switch (provider) {
    case 'google':
      return isDark
        ? require('../assets/google_dark.png')
        : require('../assets/google.png');
    case 'bing':
      return isDark
        ? require('../assets/bing_dark.png')
        : require('../assets/bing.png');
    case 'baidu':
      return isDark
        ? require('../assets/baidu_dark.png')
        : require('../assets/baidu.png');
    case 'tavily':
      return isDark
        ? require('../assets/tavily_dark.png')
        : require('../assets/tavily.png');
    case 'disabled':
    default:
      return require('../assets/web_search_grey.png');
  }
};
