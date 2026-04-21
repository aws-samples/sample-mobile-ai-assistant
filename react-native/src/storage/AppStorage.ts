import { SavedApp } from '../types/Chat.ts';
import { storage } from './StorageUtils.ts';

const keyPrefix = 'bedrock/';
const savedAppsKey = keyPrefix + 'savedAppsKey';

export type AppMetadata = Omit<SavedApp, 'htmlCode'>;
let cachedAppMetadata: AppMetadata[] | undefined;

const getAppCodeKey = (appId: string) => `app_code_${appId}`;

export function saveApp(app: SavedApp): void {
  const { htmlCode, ...metadata } = app;
  storage.set(getAppCodeKey(app.id), htmlCode);
  const apps = getSavedApps();
  const existingIndex = apps.findIndex(a => a.id === app.id);
  if (existingIndex >= 0) {
    apps[existingIndex] = metadata;
  } else {
    apps.unshift(metadata);
  }
  cachedAppMetadata = apps;
  storage.set(savedAppsKey, JSON.stringify(apps));
}

export function getSavedApps(): AppMetadata[] {
  if (cachedAppMetadata) {
    return [...cachedAppMetadata];
  }
  const appsString = storage.getString(savedAppsKey) ?? '';
  if (appsString.length > 0) {
    cachedAppMetadata = JSON.parse(appsString) as AppMetadata[];
    return [...cachedAppMetadata];
  }
  return [];
}

export function deleteApp(appId: string): void {
  storage.delete(getAppCodeKey(appId));
  const apps = getSavedApps().filter(a => a.id !== appId);
  cachedAppMetadata = apps;
  storage.set(savedAppsKey, JSON.stringify(apps));
}

export function getAppById(appId: string): SavedApp | undefined {
  const metadata = getSavedApps().find(a => a.id === appId);
  if (!metadata) {
    return undefined;
  }
  const htmlCode = storage.getString(getAppCodeKey(appId)) ?? '';
  return { ...metadata, htmlCode };
}

export function pinApp(appId: string): void {
  const apps = getSavedApps();
  const index = apps.findIndex(a => a.id === appId);
  if (index > 0) {
    const [app] = apps.splice(index, 1);
    apps.unshift(app);
    cachedAppMetadata = apps;
    storage.set(savedAppsKey, JSON.stringify(apps));
  }
}

export function renameApp(appId: string, newName: string): void {
  const apps = getSavedApps();
  const app = apps.find(a => a.id === appId);
  if (app) {
    app.name = newName;
    cachedAppMetadata = apps;
    storage.set(savedAppsKey, JSON.stringify(apps));
  }
}

export function clearSavedApps(): void {
  const apps = getSavedApps();
  apps.forEach(app => {
    storage.delete(getAppCodeKey(app.id));
  });
  storage.delete(savedAppsKey);
  cachedAppMetadata = undefined;
}
