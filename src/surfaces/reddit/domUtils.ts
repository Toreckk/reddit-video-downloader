export function isRedditLocation(location: Location): boolean {
  const hostname = location.hostname.toLowerCase();
  return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
}

export function textFrom(root: ParentNode, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const text = root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return undefined;
}

export function attributeFrom(element: Element, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

export function collectUrls(
  element: Element,
  attributeCandidates: readonly string[],
  locationHref: string,
): URL[] {
  const rawUrls = new Set<string>();
  for (const attribute of attributeCandidates) {
    const value = element.getAttribute(attribute);
    if (value) rawUrls.add(value);
  }
  for (const link of element.querySelectorAll<HTMLAnchorElement>('a[href]')) rawUrls.add(link.href);
  for (const frame of element.querySelectorAll<HTMLIFrameElement>(
    'iframe[src], iframe[data-src]',
  )) {
    rawUrls.add(frame.getAttribute('data-src') ?? frame.src);
  }

  const urls: URL[] = [];
  for (const raw of rawUrls) {
    try {
      const url = new URL(raw, locationHref);
      if (url.protocol === 'http:' || url.protocol === 'https:') urls.push(url);
    } catch {
      // Ignore malformed URLs found in page-owned attributes.
    }
  }
  return urls;
}

export function collectActivatedEmbedUrls(element: Element, locationHref: string): URL[] {
  const urls: URL[] = [];
  for (const frame of element.querySelectorAll<HTMLIFrameElement>('iframe[src]')) {
    if (elementOrAncestorIsCollapsed(frame, element)) continue;
    try {
      const url = new URL(frame.src, locationHref);
      if (url.protocol === 'http:' || url.protocol === 'https:') urls.push(url);
    } catch {
      // Ignore malformed iframe URLs owned by the page.
    }
  }
  return urls;
}

export function collectActivatedNativeMediaUrls(
  element: Element,
  outboundUrls: readonly URL[],
): URL[] {
  const players = element.querySelectorAll(
    'video, shreddit-player, .reddit-video-player, [data-testid="video-player"]',
  );
  const hasExpandedPlayer = Array.from(players).some(
    (player) => !elementOrAncestorIsCollapsed(player, element),
  );
  if (!hasExpandedPlayer) return [];
  return outboundUrls.filter((url) => url.hostname.toLowerCase() === 'v.redd.it');
}

function elementOrAncestorIsCollapsed(element: Element, boundary: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true')
      return true;
    const inlineStyle = current.getAttribute('style')?.toLowerCase() ?? '';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(inlineStyle)) return true;
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return true;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return false;
}

export function elementIsVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  return (
    rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth
  );
}

export function thumbnailFrom(
  element: Element,
  attributeNames: readonly string[],
): string | undefined {
  const attribute = attributeFrom(element, attributeNames);
  if (attribute && isHttpUrl(attribute)) return attribute;
  const image = element.querySelector<HTMLImageElement>('img[src]');
  return image?.src && isHttpUrl(image.src) ? image.src : undefined;
}

export function stripPrefix(value: string | undefined, prefix: RegExp): string | undefined {
  const stripped = value?.trim().replace(prefix, '').trim();
  return stripped || undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
