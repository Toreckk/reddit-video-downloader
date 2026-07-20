import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGifResponse } from '@/src/providers/redgifs/schema';

const fixture = JSON.parse(readFileSync('tests/fixtures/redgifs/audio.json', 'utf8')) as unknown;

describe('parseGifResponse', () => {
  it('validates only the fields used by the extension', () => {
    const parsed = parseGifResponse(fixture);
    expect(parsed).toMatchObject({
      id: 'ExampleVideo',
      creator: 'Redgifs Artist ✨',
      hasAudio: true,
      hls: true,
    });
    expect(parsed.urls.hd).toContain('.mp4');
    expect(parsed.urls.sd).toContain('.mp4');
  });

  it('falls back to the account handle when no uploader display name is available', () => {
    expect(
      parseGifResponse({
        gif: {
          id: 'ExampleVideo',
          userName: 'redgifs_artist',
          urls: { hd: 'https://media.redgifs.com/ExampleVideo.mp4' },
        },
      }).creator,
    ).toBe('redgifs_artist');
  });

  it.each([
    null,
    {},
    { gif: { id: 42, urls: {} } },
    { gif: { id: 'x', urls: { hd: 42 } } },
    { gif: { id: 'x', urls: { hd: 'javascript:alert(1)' } } },
  ])('rejects malformed data', (value) => {
    expect(() => parseGifResponse(value)).toThrow();
  });
});
