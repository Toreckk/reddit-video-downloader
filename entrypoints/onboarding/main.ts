import {
  reloadOpenRedditTabs,
  requestRequiredHostPermissions,
} from '@/src/core/infrastructure/hostPermissions';

const enableButton = requiredElement<HTMLButtonElement>('#enable-access');
const status = requiredElement<HTMLElement>('#status');

enableButton.addEventListener('click', () => {
  // This must be the first asynchronous browser call in the user-input handler.
  const permissionRequest = requestRequiredHostPermissions();
  enableButton.disabled = true;
  status.textContent = 'Waiting for Firefox permission confirmation…';
  void finishSetup(permissionRequest);
});

async function finishSetup(permissionRequest: Promise<boolean>): Promise<void> {
  try {
    const granted = await permissionRequest;
    if (!granted) {
      status.textContent = 'Access was not granted. You can try again when you are ready.';
      enableButton.disabled = false;
      return;
    }

    status.textContent = 'Access enabled. Reloading open Reddit tabs…';
    await reloadOpenRedditTabs();
    status.textContent = 'Ready. Download buttons will now appear automatically on Reddit.';
    enableButton.textContent = 'Access enabled';
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : 'Firefox could not update the site permissions.';
    enableButton.disabled = false;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The setup page is missing ${selector}.`);
  return element;
}
