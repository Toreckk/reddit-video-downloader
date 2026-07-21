export interface PostContext {
  surfaceId: string;
  postElement: HTMLElement;
  postId: string;
  outboundUrls: URL[];
  activatedOutboundUrls: URL[];
  title?: string;
  author?: string;
  subreddit?: string;
  thumbnailUrl?: string;
  documentOrder: number;
  isVisible: boolean;
}

export interface SiteSurfaceAdapter {
  readonly id: string;
  matchesPage(location: Location): boolean;
  discover(root: ParentNode): PostContext[];
}
