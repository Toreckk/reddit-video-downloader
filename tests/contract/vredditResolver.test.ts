import { describe, expect, it } from 'vitest';
import type { MediaReference } from '@/src/core/domain/media';
import type { HttpClient, HttpResponse } from '@/src/core/infrastructure/extensionHttpClient';
import { VRedditResolver, parseDashManifest } from '@/src/providers/vreddit/resolver';

const reference: MediaReference = {
  providerId: 'vreddit',
  canonicalId: 'xko5vazktfeh1',
  sourceUrl: 'https://v.redd.it/xko5vazktfeh1',
};

const manifest = `<?xml version="1.0"?>
<MPD mediaPresentationDuration="PT17.066668S">
  <Period>
    <AdaptationSet mimeType="video/mp4" codecs="avc1.4d401f">
      <Representation id="480" bandwidth="700000" width="854" height="480"><BaseURL>CMAF_480.mp4</BaseURL></Representation>
      <Representation id="720" bandwidth="1600000" width="1280" height="720"><BaseURL>CMAF_720.mp4</BaseURL></Representation>
      <Representation id="unsafe" bandwidth="9999999" width="1920" height="1080"><BaseURL>https://example.com/video.mp4</BaseURL></Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
      <Representation id="audio-64" bandwidth="64000"><BaseURL>CMAF_AUDIO_64.mp4</BaseURL></Representation>
      <Representation id="audio-128" bandwidth="128000"><BaseURL>CMAF_AUDIO_128.mp4</BaseURL></Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

function response(status: number, body: string): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

describe('VRedditResolver contract', () => {
  it('selects safe MP4 representations and pairs every video with the best audio track', async () => {
    const http: HttpClient = { get: async () => response(200, manifest) };
    const resolved = await new VRedditResolver(http).resolve(reference, {});

    expect(resolved.durationSeconds).toBeCloseTo(17.066668);
    expect(resolved.variants.map((variant) => variant.id)).toEqual(['720', '480']);
    expect(resolved.variants[0]).toMatchObject({
      quality: 'hd',
      width: 1280,
      height: 720,
      hasAudio: true,
      asset: {
        kind: 'separate-mp4-tracks',
        videoUrl: 'https://v.redd.it/xko5vazktfeh1/CMAF_720.mp4',
        audioUrl: 'https://v.redd.it/xko5vazktfeh1/CMAF_AUDIO_128.mp4',
      },
    });
    expect(resolved.variants[1]?.quality).toBe('sd');
  });

  it('rejects malformed XML', () => {
    expect(() =>
      parseDashManifest(
        '<not-mpd>',
        `${reference.sourceUrl}/DASHPlaylist.mpd`,
        reference.canonicalId,
      ),
    ).toThrow(/malformed/i);
  });

  it('reports removed media distinctly', async () => {
    const http: HttpClient = { get: async () => response(404, '') };
    await expect(new VRedditResolver(http).resolve(reference, {})).rejects.toMatchObject({
      code: 'MEDIA_NOT_FOUND',
    });
  });
});
