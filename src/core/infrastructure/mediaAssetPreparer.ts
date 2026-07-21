import {
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';
import { AppError } from '@/src/core/domain/errors';
import type { MediaAsset } from '@/src/core/domain/media';
import type { HttpClient, HttpResponse } from './extensionHttpClient';

export type PreparedMediaAsset = { kind: 'url'; url: string } | { kind: 'blob'; blob: Blob };

export interface MediaAssetPreparer {
  prepare(asset: MediaAsset): Promise<PreparedMediaAsset>;
}

export class BrowserMediaAssetPreparer implements MediaAssetPreparer {
  constructor(private readonly http: HttpClient) {}

  async prepare(asset: MediaAsset): Promise<PreparedMediaAsset> {
    if (asset.kind === 'direct') return { kind: 'url', url: asset.url };

    try {
      const [videoResponse, audioResponse] = await Promise.all([
        this.http.get(asset.videoUrl),
        this.http.get(asset.audioUrl),
      ]);
      ensureSuccessfulMediaResponse(videoResponse, 'video');
      ensureSuccessfulMediaResponse(audioResponse, 'audio');
      const [videoData, audioData] = await Promise.all([
        videoResponse.arrayBuffer(),
        audioResponse.arrayBuffer(),
      ]);
      return { kind: 'blob', blob: await remuxMp4Tracks(videoData, audioData) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'MEDIA_PROCESSING_FAILED',
        'Could not combine the Reddit video and audio.',
        {
          cause: error,
        },
      );
    }
  }
}

export async function remuxMp4Tracks(
  videoData: ArrayBuffer,
  audioData: ArrayBuffer,
): Promise<Blob> {
  const videoInput = new Input({ source: new BlobSource(new Blob([videoData])), formats: [MP4] });
  const audioInput = new Input({ source: new BlobSource(new Blob([audioData])), formats: [MP4] });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  try {
    const [videoTrack, audioTrack] = await Promise.all([
      videoInput.getPrimaryVideoTrack(),
      audioInput.getPrimaryAudioTrack(),
    ]);
    if (!videoTrack || !audioTrack) throw new Error('A required media track is missing.');

    const [videoCodec, audioCodec, videoConfig, audioConfig, rotation] = await Promise.all([
      videoTrack.getCodec(),
      audioTrack.getCodec(),
      videoTrack.getDecoderConfig(),
      audioTrack.getDecoderConfig(),
      videoTrack.getRotation(),
    ]);
    if (!videoCodec || !audioCodec || !videoConfig || !audioConfig) {
      throw new Error('A required MP4 codec configuration is missing.');
    }

    const videoSource = new EncodedVideoPacketSource(videoCodec);
    const audioSource = new EncodedAudioPacketSource(audioCodec);
    output.addVideoTrack(videoSource, { rotation });
    output.addAudioTrack(audioSource);
    await output.start();

    const videoPackets = new EncodedPacketSink(videoTrack).packets();
    const audioPackets = new EncodedPacketSink(audioTrack).packets();
    let [videoResult, audioResult] = await Promise.all([videoPackets.next(), audioPackets.next()]);
    if (videoResult.done || audioResult.done) throw new Error('A required media track is empty.');
    let firstVideoPacket = true;
    let firstAudioPacket = true;

    while (!videoResult.done || !audioResult.done) {
      const takeVideo =
        !videoResult.done &&
        (audioResult.done || videoResult.value.timestamp <= audioResult.value.timestamp);
      if (takeVideo) {
        if (videoResult.done) break;
        const packet = videoResult.value;
        await videoSource.add(
          packet,
          firstVideoPacket ? { decoderConfig: videoConfig } : undefined,
        );
        firstVideoPacket = false;
        videoResult = await videoPackets.next();
      } else if (!audioResult.done) {
        const packet = audioResult.value;
        await audioSource.add(
          packet,
          firstAudioPacket ? { decoderConfig: audioConfig } : undefined,
        );
        firstAudioPacket = false;
        audioResult = await audioPackets.next();
      }
    }

    videoSource.close();
    audioSource.close();
    await output.finalize();
    if (!target.buffer) throw new Error('The MP4 output was empty.');
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (error) {
    if (output.state === 'started') await output.cancel();
    throw error;
  } finally {
    videoInput.dispose();
    audioInput.dispose();
  }
}

function ensureSuccessfulMediaResponse(response: HttpResponse, track: 'video' | 'audio'): void {
  if (response.ok) return;
  throw new AppError('NETWORK_ERROR', `Reddit could not provide the ${track} track.`, {
    cause: new Error(`HTTP ${response.status}`),
  });
}
