import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;
const NGINX_UA_RE = /(Bitcraft-XP-Calculator-Proxy\/)([^\s";]+)/;

export function isValidSemver(value) {
  return typeof value === 'string' && SEMVER_RE.test(value.trim());
}

/**
 * Computes the next SemVer string from a current version and a target
 * ('patch' | 'minor' | 'major' | explicit 'X.Y.Z' with optional leading 'v').
 */
export function computeNextVersion(currentVersion, target) {
  if (!isValidSemver(currentVersion)) {
    throw new Error(`Invalid current version: "${currentVersion}"`);
  }
  if (typeof target !== 'string' || target.trim().length === 0) {
    throw new Error('Target version or increment (patch | minor | major | X.Y.Z) is required.');
  }

  const normalizedTarget = target.trim();
  const [, majorStr, minorStr, patchStr] = SEMVER_RE.exec(currentVersion.trim());
  const major = Number(majorStr);
  const minor = Number(minorStr);
  const patch = Number(patchStr);

  if (normalizedTarget === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (normalizedTarget === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  if (normalizedTarget === 'major') {
    return `${major + 1}.0.0`;
  }

  const stripped = normalizedTarget.startsWith('v') ? normalizedTarget.slice(1) : normalizedTarget;
  if (!isValidSemver(stripped)) {
    throw new Error(
      `Invalid target version: "${target}". Use patch, minor, major, or SemVer X.Y.Z.`
    );
  }
  return stripped;
}

/**
 * Reads the version strings from all synchronized versioned project files.
 */
export function readProjectVersions(rootDir) {
  const pkgPath = resolve(rootDir, 'package.json');
  const lockPath = resolve(rootDir, 'package-lock.json');
  const manifestPath = resolve(rootDir, 'client-side-only/browser-extension/manifest.json');
  const nginxPath = resolve(rootDir, 'nginx.conf');

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const nginxRaw = readFileSync(nginxPath, 'utf8');
  const nginxMatch = NGINX_UA_RE.exec(nginxRaw);

  return {
    packageJson: pkg.version ?? null,
    packageLockRoot: lock.version ?? null,
    packageLockRootPkg: lock.packages?.['']?.version ?? null,
    extensionManifest: manifest.version ?? null,
    nginxUserAgent: nginxMatch ? nginxMatch[2] : null,
  };
}

/**
 * Verifies that all versioned project files agree on the exact same SemVer string.
 */
export function checkVersionConsistency(rootDir) {
  const versions = readProjectVersions(rootDir);
  const expectedVersion = versions.packageJson;
  const entries = [
    { label: 'package.json', version: versions.packageJson },
    { label: 'package-lock.json (root)', version: versions.packageLockRoot },
    { label: 'package-lock.json (packages[""])', version: versions.packageLockRootPkg },
    { label: 'client-side-only/browser-extension/manifest.json', version: versions.extensionManifest },
    { label: 'nginx.conf (User-Agent)', version: versions.nginxUserAgent },
  ];

  const mismatches = entries.filter(
    (entry) => !isValidSemver(entry.version) || entry.version !== expectedVersion
  );

  return {
    ok: isValidSemver(expectedVersion) && mismatches.length === 0,
    expectedVersion,
    entries,
    mismatches,
  };
}

function writeJsonPreservingNewline(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Updates all synchronized versioned project files to the target version.
 */
export function bumpProjectVersion(rootDir, target, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const pkgPath = resolve(rootDir, 'package.json');
  const lockPath = resolve(rootDir, 'package-lock.json');
  const manifestPath = resolve(rootDir, 'client-side-only/browser-extension/manifest.json');
  const nginxPath = resolve(rootDir, 'nginx.conf');

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const nginxRaw = readFileSync(nginxPath, 'utf8');

  if (!NGINX_UA_RE.test(nginxRaw)) {
    throw new Error('Could not find Bitcraft-XP-Calculator-Proxy/<version> User-Agent in nginx.conf');
  }

  const previousVersion = pkg.version;
  const nextVersion = computeNextVersion(previousVersion, target);

  const updatedFiles = [
    'package.json',
    'package-lock.json',
    'client-side-only/browser-extension/manifest.json',
    'nginx.conf',
  ];

  if (!dryRun) {
    pkg.version = nextVersion;
    lock.version = nextVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = nextVersion;
    }
    manifest.version = nextVersion;
    const updatedNginx = nginxRaw.replace(NGINX_UA_RE, `$1${nextVersion}`);

    writeJsonPreservingNewline(pkgPath, pkg);
    writeJsonPreservingNewline(lockPath, lock);
    writeJsonPreservingNewline(manifestPath, manifest);
    writeFileSync(nginxPath, updatedNginx, 'utf8');
  }

  return {
    previousVersion,
    nextVersion,
    dryRun,
    updatedFiles,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const rootDir = resolve(process.cwd());

  if (args.includes('--check')) {
    const result = checkVersionConsistency(rootDir);
    if (result.ok) {
      console.log(`Version check passed: all files are aligned at ${result.expectedVersion}`);
      return;
    }
    console.error(`Version mismatch detected (expected ${result.expectedVersion}):`);
    for (const mismatch of result.mismatches) {
      console.error(`  - ${mismatch.label}: ${mismatch.version ?? '(missing)'}`);
    }
    process.exitCode = 1;
    return;
  }

  const dryRun = args.includes('--dry-run');
  const target = args.find((arg) => !arg.startsWith('--'));
  if (!target) {
    console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z> [--dry-run]');
    console.error('       node scripts/bump-version.mjs --check');
    process.exitCode = 1;
    return;
  }

  const result = bumpProjectVersion(rootDir, target, { dryRun });
  const prefix = result.dryRun ? '[dry-run] Would bump' : 'Bumped';
  console.log(`${prefix} version: ${result.previousVersion} -> ${result.nextVersion}`);
  for (const file of result.updatedFiles) {
    console.log(`  - ${file}`);
  }
  if (!result.dryRun) {
    console.log(`Remember to add a ## [${result.nextVersion}] section to CHANGELOG.md.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli();
}
