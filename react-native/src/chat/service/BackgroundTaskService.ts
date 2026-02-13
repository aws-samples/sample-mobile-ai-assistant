import BackgroundService from 'react-native-background-actions';
import { backgroundStreamManager } from './BackgroundStreamManager';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const backgroundTask = async () => {
  while (BackgroundService.isRunning()) {
    if (backgroundStreamManager.getActiveCount() === 0) {
      await BackgroundService.stop();
      return;
    }
    await sleep(2000);
  }
};

const options = {
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

export async function startBackgroundTaskIfNeeded(): Promise<void> {
  if (!BackgroundService.isRunning()) {
    try {
      await BackgroundService.start(backgroundTask, options);
    } catch (e) {
      console.log('Failed to start background task:', e);
    }
  }
}

export async function stopBackgroundTask(): Promise<void> {
  if (BackgroundService.isRunning()) {
    try {
      await BackgroundService.stop();
    } catch (e) {
      console.log('Failed to stop background task:', e);
    }
  }
}
