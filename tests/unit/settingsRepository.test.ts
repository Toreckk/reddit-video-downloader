import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '@/src/core/infrastructure/settingsRepository';

describe('parseSettings', () => {
  it('defaults to opened embeds and the provider uploader filename', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.detectionMode).toBe('opened');
    expect(DEFAULT_SETTINGS.saveAs).toBe(true);
    expect(DEFAULT_SETTINGS.filenameTemplate).toBe('{sourceCreator|creator} - {title}');
  });

  it('asks where to save by default while retaining an explicit opt-out', () => {
    expect(parseSettings({}).saveAs).toBe(true);
    expect(parseSettings({ saveAs: true }).saveAs).toBe(true);
    expect(parseSettings({ saveAs: false }).saveAs).toBe(false);
  });

  it('accepts all-links mode', () => {
    expect(parseSettings({ detectionMode: 'all' }).detectionMode).toBe('all');
  });

  it('migrates the previous default filename while retaining custom templates', () => {
    expect(parseSettings({ filenameTemplate: '{creator} - {title}' }).filenameTemplate).toBe(
      '{sourceCreator|creator} - {title}',
    );
    expect(parseSettings({ filenameTemplate: '{creator}-{id}' }).filenameTemplate).toBe(
      '{creator}-{id}',
    );
    expect(parseSettings({ filenameTemplate: '{providerCreator}-{title}' }).filenameTemplate).toBe(
      '{sourceCreator|creator}-{title}',
    );
  });
});
