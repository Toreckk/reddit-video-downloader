const RESERVED_CHARACTERS = /[<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const UNSAFE_UNICODE_FILENAME_CHARACTERS = /[\p{C}\p{S}\uFE0E\uFE0F\u{E0100}-\u{E01EF}]/gu;

export function sanitizeFilenamePart(input: string): string {
  let value = input
    .normalize('NFKC')
    // Firefox rejects some emoji, controls, and invisible formatting characters in download names.
    // Keep ordinary Unicode letters and numbers, but remove symbol and non-printing categories.
    .replace(UNSAFE_UNICODE_FILENAME_CHARACTERS, ' ')
    .replace(/\p{Z}/gu, ' ')
    .replace(RESERVED_CHARACTERS, ' ')
    .replace(/\.\.+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '');

  if (WINDOWS_RESERVED_NAME.test(value)) value = `_${value}`;
  return value;
}

export function truncateUtf16(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input
    .slice(0, maxLength)
    .replace(/[. ]+$/g, '')
    .trim();
}
