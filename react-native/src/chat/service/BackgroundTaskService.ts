import { NativeModules, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { backgroundStreamManager } from './BackgroundStreamManager';

const { BackgroundKeepAliveModule } = NativeModules;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Android: keep using react-native-background-actions (shows notification)
const backgroundTask = async () => {
  while (BackgroundService.isRunning()) {
    if (backgroundStreamManager.getActiveCount() === 0) {
      await BackgroundService.stop();
      return;
    }
    await sleep(2000);
  }
};

const androidOptions = {
  taskName: 'AppGeneration',
  taskTitle: 'SwiftChat',
  taskDesc: 'Generating app in background...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#4A90D9',
  parameters: {},
};

// iOS: polling loop that only checks for completion
let iosPollingActive = false;

async function startIOSPolling(): Promise<void> {
  if (iosPollingActive) {
    return;
  }
  iosPollingActive = true;
  while (iosPollingActive) {
    await sleep(2000);
    const activeCount = backgroundStreamManager.getActiveCount();

    if (activeCount === 0) {
      // All done — end Live Activity with completion state, then clean up
      await stopBackgroundTask();
      return;
    }
  }
}

export async function startBackgroundTaskIfNeeded(): Promise<void> {
  if (Platform.OS === 'ios' && BackgroundKeepAliveModule) {
    const running = await BackgroundKeepAliveModule.isRunning();
    if (!running) {
      await BackgroundKeepAliveModule.start();
    }
    const totalCount = backgroundStreamManager.getTotalCount();
    try {
      await BackgroundKeepAliveModule.startLiveActivity(totalCount);
    } catch {}
    startIOSPolling();
  } else {
    if (!BackgroundService.isRunning()) {
      try {
        await BackgroundService.start(backgroundTask, androidOptions);
      } catch (e) {
        console.log('Failed to start background task:', e);
      }
    }
  }
}

export async function stopBackgroundTask(): Promise<void> {
  backgroundStreamManager.removeCompleted();
  if (Platform.OS === 'ios' && BackgroundKeepAliveModule) {
    iosPollingActive = false;
    try {
      await BackgroundKeepAliveModule.endLiveActivity();
    } catch {}
    try {
      await BackgroundKeepAliveModule.stop();
    } catch (e) {
      console.log('Failed to stop background audio:', e);
    }
  } else {
    if (BackgroundService.isRunning()) {
      try {
        await BackgroundService.stop();
      } catch (e) {
        console.log('Failed to stop background task:', e);
      }
    }
  }
}
