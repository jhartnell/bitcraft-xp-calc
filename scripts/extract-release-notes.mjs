import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMVER_TAG_RE = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

/**
 * Validates a Git release tag against SemVer (e.g. v1.9.1 or v1.9.2-rc.1).
 */
export function validateReleaseTag(tag) {
  if (typeof tag !== 'string') {
    throw new Error('Release tag must be a string.');
  }
  const trimmed = tag.trim();
  const match = SEMVER_TAG_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid release tag format: "${tag}". Expected vX.Y.Z (optional prerelease).`);
  }
  return { tag: trimmed, version: match[1] };
}

/**
 * Extracts the body of a specific `## [X.Y.Z]` section from a Keep a Changelog file.
 * Returns null if the section does not exist or is empty.
 */
export function extractChangelogSection(changelogContent, version) {
  if (!changelogContent || !version) return null;
  const lines = changelogContent.replace(/\r\n/g, '\n').split('\n');
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp(`^##\\s+\\[${escapedVersion}\\](?:\\s|$)`);

  const startIndex = lines.findIndex((line) => headingRe.test(line));
  if (startIndex === -1) return null;

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+\[/.test(line)) {
      break;
    }
    collected.push(line);
  }

  // Trim blank lines and trailing horizontal rules (`---`) separating changelog versions
  while (collected.length > 0 && collected[0].trim() === '') {
    collected.shift();
  }
  while (
    collected.length > 0 &&
    (collected[collected.length - 1].trim() === '' || /^-{3,}$/.test(collected[collected.length - 1].trim()))
  ) {
    collected.pop();
  }

  const section = collected.join('\n').trim();
  return section.length > 0 ? section : null;
}

/**
 * Builds complete Markdown release notes combining CHANGELOG.md details with Docker & extension install info.
 * Returns null if no matching changelog entry exists (signaling the caller to fall back to auto-generated notes).
 */
export function buildReleaseNotes({
  tag,
  changelogContent,
  repository = 'jhartnell/bitcraft-xp-calc',
  extensionAssetName,
}) {
  const { tag: normalizedTag, version } = validateReleaseTag(tag);
  const changelogSection = extractChangelogSection(changelogContent, version);
  if (!changelogSection) {
    return null;
  }

  const repoLower = repository.toLowerCase();
  const assetName = extensionAssetName || `bitcraft-xp-calc-extension-${normalizedTag}.zip`;

  return [
    changelogSection,
    '',
    '---',
    '',
    '### Docker Image (GHCR)',
    '```bash',
    `docker pull ghcr.io/${repoLower}:${version}`,
    '```',
    '',
    '### Browser Extension',
    `Download \`${assetName}\`, verify its SHA-256 hash against \`SHA256SUMS.txt\`, unzip it, and load the extracted folder in \`chrome://extensions\` with **Developer mode** enabled.`,
    '',
  ].join('\n');
}

function runCli() {
  const tag = process.env.RELEASE_TAG || process.argv[2];
  const repository = process.env.GITHUB_REPOSITORY || 'jhartnell/bitcraft-xp-calc';
  const changelogPath = resolve(process.env.CHANGELOG_PATH || 'CHANGELOG.md');
  const outputPath = process.env.OUTPUT_PATH ? resolve(process.env.OUTPUT_PATH) : null;

  const { tag: normalizedTag } = validateReleaseTag(tag);
  const changelogContent = readFileSync(changelogPath, 'utf8');
  const notes = buildReleaseNotes({
    tag: normalizedTag,
    changelogContent,
    repository,
  });

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, notes ?? '', 'utf8');
  } else if (notes) {
    process.stdout.write(notes);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli();
}
