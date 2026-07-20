import type { DownloadGateway } from '@/src/core/infrastructure/browserDownloadGateway';
import type { SettingsReader } from '@/src/core/infrastructure/settingsRepository';
import type { MediaReference, PostMetadata } from '@/src/core/domain/media';
import { createDownloadFilename, type FilenameContext } from './filenamePolicy';
import type { ProviderRegistry } from './providerRegistry';
import { selectVariant } from './variantPolicy';

export interface ResolveAndDownloadCommand {
  reference: MediaReference;
  post: PostMetadata;
}

export interface DownloadResult {
  downloadId: number;
  filename: string;
  warning?: string;
}

export class ResolveAndDownload {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly settings: SettingsReader,
    private readonly downloads: DownloadGateway,
  ) {}

  async execute(command: ResolveAndDownloadCommand): Promise<DownloadResult> {
    const provider = this.registry.get(command.reference.providerId);
    const settings = await this.settings.get();
    const resolved = await provider.resolve(command.reference, {});
    const selection = selectVariant(resolved, settings.preferredQuality);
    const filenameContext: FilenameContext = {
      reference: command.reference,
      post: command.post,
      template: settings.filenameTemplate,
    };
    if (resolved.creator !== undefined) filenameContext.sourceCreator = resolved.creator;
    const filename = createDownloadFilename(filenameContext);
    const downloadId = await this.downloads.start({
      url: selection.variant.url,
      filename,
      saveAs: settings.saveAs,
    });
    return selection.warning
      ? { downloadId, filename, warning: selection.warning }
      : { downloadId, filename };
  }
}
