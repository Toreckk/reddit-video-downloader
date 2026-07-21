import {
  SettingsRepository,
  type PreferredQuality,
} from '@/src/core/infrastructure/settingsRepository';

const form = requiredElement<HTMLFormElement>('#settings-form');
const quality = requiredElement<HTMLSelectElement>('#quality');
const saveAs = requiredElement<HTMLInputElement>('#save-as');
const filenameTemplate = requiredElement<HTMLInputElement>('#filename-template');
const detectionMode = requiredElement<HTMLSelectElement>('#detection-mode');
const status = requiredElement<HTMLElement>('#save-status');

const repository = new SettingsRepository();

async function load(): Promise<void> {
  const settings = await repository.get();
  quality.value = settings.preferredQuality;
  saveAs.checked = settings.saveAs;
  filenameTemplate.value = settings.filenameTemplate;
  detectionMode.value = settings.detectionMode;
}

form.addEventListener('submit', (event) => {
  void save(event);
});

async function save(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const template = filenameTemplate.value.trim();
  if (
    !/\{(?:sourceCreator|creator|title|provider|id)(?:\|(?:sourceCreator|creator|title|provider|id))*\}/.test(
      template,
    )
  ) {
    status.textContent = 'Include at least one filename field.';
    return;
  }
  await repository.set({
    preferredQuality: quality.value as PreferredQuality,
    saveAs: saveAs.checked,
    filenameTemplate: template,
    enabledProviders: ['redgifs', 'vreddit'],
    detectionMode: detectionMode.value === 'all' ? 'all' : 'opened',
  });
  status.textContent = 'Saved.';
  window.setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

void load();

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The options document is missing ${selector}.`);
  return element;
}
