import { CurrentRedditAdapter } from './reddit/currentRedditAdapter';
import { OldRedditAdapter } from './reddit/oldRedditAdapter';
import type { SiteSurfaceAdapter } from './reddit/types';

export const surfaces: readonly SiteSurfaceAdapter[] = [
  new OldRedditAdapter(),
  new CurrentRedditAdapter(),
];
