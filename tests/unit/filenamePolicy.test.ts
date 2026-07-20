import { describe, expect, it } from 'vitest';
import {
  createDownloadFilename,
  type FilenameContext,
} from '@/src/core/application/filenamePolicy';

const reference = {
  providerId: 'redgifs',
  canonicalId: 'exampleclip',
  sourceUrl: 'https://www.redgifs.com/watch/exampleclip',
};

function filename(
  creator?: string,
  title?: string,
  template = '{creator} - {title}',
  sourceCreator?: string,
): string {
  const post: { postId: string; creator?: string; title?: string } = { postId: 't3_test' };
  if (creator !== undefined) post.creator = creator;
  if (title !== undefined) post.title = title;
  const context: FilenameContext = { reference, post, template };
  if (sourceCreator !== undefined) context.sourceCreator = sourceCreator;
  return createDownloadFilename(context);
}

describe('createDownloadFilename', () => {
  it('uses creator and title and strips a u/ prefix', () => {
    expect(filename('u/example_user', 'A great clip')).toBe('example_user - A great clip.mp4');
  });

  it('uses safe fallbacks for missing metadata', () => {
    expect(filename('[deleted]', 'A title')).toBe('unknown - A title.mp4');
    expect(filename('alice')).toBe('alice - redgifs-exampleclip.mp4');
    expect(filename()).toBe('redgifs-exampleclip.mp4');
  });

  it('removes reserved characters and traversal sequences', () => {
    const value = filename('..\\CON', '../bad:<title>?');
    expect(value).not.toMatch(/[<>:"/\\|?*]/);
    expect(value).not.toContain('..');
    expect(value.endsWith('.mp4')).toBe(true);
  });

  it('removes emoji and invisible characters while retaining ordinary Unicode text', () => {
    expect(filename('alice', 'Café 😀️\u200B\u00AD 日本語')).toBe('alice - Café 日本語.mp4');
  });

  it('does not generate a leading-dot filename', () => {
    expect(filename(undefined, '.hidden title', '{title}')).toBe('hidden title.mp4');
  });

  it('normalizes reserved Windows names and limits long names', () => {
    expect(filename('alice', 'CON', '{title}')).toBe('_CON.mp4');
    expect(filename('alice', 'x'.repeat(400)).length).toBeLessThanOrEqual(180);
  });

  it('supports the documented template tokens', () => {
    expect(
      filename(
        'alice',
        'clip',
        '{provider}-{id}-{sourceCreator}-{creator}-{title}',
        'redgifs_artist',
      ),
    ).toBe('redgifs-exampleclip-redgifs_artist-alice-clip.mp4');
  });

  it('uses the first available field in a fallback expression', () => {
    expect(filename('alice', 'clip', '{sourceCreator|creator} - {title}')).toBe('alice - clip.mp4');
    expect(filename('alice', 'clip', '{sourceCreator|creator}', 'redgifs_artist')).toBe(
      'redgifs_artist.mp4',
    );
  });

  it('retains the provider uploader when Reddit metadata is missing', () => {
    expect(
      filename(undefined, undefined, '{sourceCreator|creator} - {title}', 'redgifs_artist'),
    ).toBe('redgifs_artist - redgifs-exampleclip.mp4');
  });

  it('supports chained fallback fields from left to right', () => {
    expect(filename(undefined, 'clip', '{sourceCreator|creator|id}')).toBe('exampleclip.mp4');
  });
});
