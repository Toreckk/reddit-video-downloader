import { browser } from 'wxt/browser';
import type { DetectionMode } from '@/src/core/domain/media';

export type PreferredQuality = 'hd' | 'sd';

export interface ExtensionSettings {
  preferredQuality: PreferredQuality;
  saveAs: boolean;
  filenameTemplate: string;
  enabledProviders: string[];
  detectionMode: DetectionMode;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  preferredQuality: 'hd',
  saveAs: false,
  filenameTemplate: '{sourceCreator|creator} - {title}',
  enabledProviders: ['redgifs'],
  detectionMode: 'opened',
};

const STORAGE_KEY = 'settings';

export interface SettingsReader {
  get(): Promise<ExtensionSettings>;
}

export class SettingsRepository implements SettingsReader {
  async get(): Promise<ExtensionSettings> {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return parseSettings(stored[STORAGE_KEY]);
  }

  async set(settings: ExtensionSettings): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEY]: parseSettings(settings) });
  }
}

export function parseSettings(value: unknown): ExtensionSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = value as Record<string, unknown>;
  return {
    preferredQuality: candidate.preferredQuality === 'sd' ? 'sd' : 'hd',
    saveAs: candidate.saveAs === true,
    filenameTemplate: parseFilenameTemplate(candidate.filenameTemplate),
    enabledProviders: Array.isArray(candidate.enabledProviders)
      ? candidate.enabledProviders.filter((item): item is string => typeof item === 'string')
      : [...DEFAULT_SETTINGS.enabledProviders],
    detectionMode: candidate.detectionMode === 'all' ? 'all' : 'opened',
  };
}

function parseFilenameTemplate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_SETTINGS.filenameTemplate;
  const template = value.slice(0, 160).replaceAll('{providerCreator}', '{sourceCreator|creator}');
  return template === '{creator} - {title}' ? DEFAULT_SETTINGS.filenameTemplate : template;
}
