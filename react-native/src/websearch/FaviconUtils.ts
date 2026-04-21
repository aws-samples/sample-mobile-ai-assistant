import { storage } from '../storage/StorageUtils';

const FAVICON_CACHE_KEY = 'favicon_services_map';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

type FaviconCache = {
  [domain: string]: {
    service: string;
    timestamp: number;
  };
};

/**
 * Get favicon URL for a given website URL
 * Uses multiple services with automatic selection based on cached fastest response
 */
export const getFaviconUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Get cache map
    const cache = getCacheMap();
    const cached = cache[domain];

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return getFaviconServiceUrl(domain, cached.service);
    }

    // Detect locale for initial service selection
    let locale = 'en';
    try {
      locale = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch (e) {
      console.log('Failed to get locale, using default');
    }

    // Default to favicon.splitbee for non-Chinese regions, Google for Chinese regions
    const isChinese =
      locale.toLowerCase().includes('cn') ||
      locale.toLowerCase().includes('zh');
    const defaultService = isChinese ? 'favicon' : 'google';

    // Start background race to find fastest service (no await, fire and forget)
    findFastestService(domain);

    return getFaviconServiceUrl(domain, defaultService);
  } catch (error) {
    console.log('Failed to parse URL:', error);
    return null;
  }
};

/**
 * Get cache map from storage
 */
const getCacheMap = (): FaviconCache => {
  try {
    const cached = storage.getString(FAVICON_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    return {};
  }
};

/**
 * Update cache map in storage
 */
const updateCache = (domain: string, service: string) => {
  try {
    const cache = getCacheMap();
    cache[domain] = {
      service,
      timestamp: Date.now(),
    };
    storage.set(FAVICON_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.log('Failed to update favicon cache:', error);
  }
};

/**
 * Get favicon URL for a specific service
 */
const getFaviconServiceUrl = (domain: string, service: string): string => {
  switch (service) {
    case 'google':
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    case 'favicon':
      return `https://favicon.splitbee.io/?url=${domain}`;
    case 'faviconim':
      return `https://favicon.im/${domain}`;
    case 'direct':
      return `https://${domain}/favicon.ico`;
    default:
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }
};

/**
 * Background task to find and cache the fastest favicon service
 */
const findFastestService = async (domain: string) => {
  const services = ['google', 'favicon', 'faviconim', 'direct'];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    // Race all services
    const promises = services.map(async service => {
      const url = getFaviconServiceUrl(domain, service);
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        reactNative: { textStreaming: true },
      });
      if (response.ok) {
        return service;
      }
      throw new Error(`Failed: ${service}`);
    });

    // Get first successful service
    const fastestService = await Promise.race(
      promises.map(p => p.catch(() => null))
    );

    if (fastestService) {
      // Cache the fastest service using unified cache
      updateCache(domain, fastestService);
    }
  } catch (error) {
    // Silent fail - default service will be used
  } finally {
    clearTimeout(timeout);
  }
};
