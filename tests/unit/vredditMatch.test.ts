import { describe, expect, it } from 'vitest';
import { matchVRedditUrl } from '@/src/providers/vreddit/match';

describe('matchVRedditUrl', () => {
  it('normalizes base and media URLs to the Reddit video id', () => {
    expect(matchVRedditUrl(new URL('https://v.redd.it/Xko5VazKtfeh1'))).toEqual({
      providerId: 'vreddit',
      canonicalId: 'xko5vazktfeh1',
      sourceUrl: 'https://v.redd.it/xko5vazktfeh1',
    });
    expect(
      matchVRedditUrl(new URL('https://v.redd.it/xko5vazktfeh1/CMAF_720.mp4#mp4'))?.canonicalId,
    ).toBe('xko5vazktfeh1');
  });

  it('rejects lookalike hosts and malformed ids', () => {
    expect(matchVRedditUrl(new URL('https://v.redd.it.example/xko5vazktfeh1'))).toBeNull();
    expect(matchVRedditUrl(new URL('https://v.redd.it/no'))).toBeNull();
  });
});
