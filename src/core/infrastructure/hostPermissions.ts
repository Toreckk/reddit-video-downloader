import { browser } from 'wxt/browser';
import { REDGIFS_REQUIRED_ORIGINS } from '@/src/providers/redgifs';
import { VREDDIT_REQUIRED_ORIGINS } from '@/src/providers/vreddit';

export const REDDIT_REQUIRED_ORIGINS = ['*://*.reddit.com/*'] as const;

export const REQUIRED_HOST_ORIGINS = [
  ...REDDIT_REQUIRED_ORIGINS,
  ...REDGIFS_REQUIRED_ORIGINS,
  ...VREDDIT_REQUIRED_ORIGINS,
] as const;

export function containsRequiredHostPermissions(): Promise<boolean> {
  return browser.permissions.contains({ origins: [...REQUIRED_HOST_ORIGINS] });
}

/**
 * Call this synchronously from an extension-page click handler. Firefox discards
 * the user-action privilege as soon as the handler awaits another promise.
 */
export function requestRequiredHostPermissions(): Promise<boolean> {
  return browser.permissions.request({ origins: [...REQUIRED_HOST_ORIGINS] });
}

export async function reloadOpenRedditTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ url: [...REDDIT_REQUIRED_ORIGINS] });
  await Promise.all(
    tabs.map((tab) => (tab.id === undefined ? Promise.resolve() : browser.tabs.reload(tab.id))),
  );
}

export async function openPermissionSetup(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
}
