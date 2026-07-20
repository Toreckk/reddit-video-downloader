import { PopupController } from '@/src/popup/controller';

const status = requiredElement<HTMLElement>('#status');
const list = requiredElement<HTMLUListElement>('#media-list');
const refresh = requiredElement<HTMLButtonElement>('#refresh');
const options = requiredElement<HTMLButtonElement>('#options');
const search = requiredElement<HTMLInputElement>('#media-search');
const clear = requiredElement<HTMLButtonElement>('#clear-shown');

new PopupController(status, list, refresh, options, search, clear).init();

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The popup document is missing ${selector}.`);
  return element;
}
