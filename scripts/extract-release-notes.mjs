import { writeFile } from 'node:fs/promises';
import { loadVersionMetadata } from './release-metadata.mjs';

const outputIndex = process.argv.indexOf('--output');
const output = outputIndex === -1 ? undefined : process.argv[outputIndex + 1];
if (!output) throw new Error('Usage: node scripts/extract-release-notes.mjs --output <path>');

const metadata = await loadVersionMetadata();
await writeFile(output, metadata.releaseNotes);
console.log(`Wrote ${metadata.tagName} release notes to ${output}.`);
