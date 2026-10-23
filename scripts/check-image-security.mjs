import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
function reject(reason) { throw new Error('Image security report rejected: ' + reason); }
export function validateImageReport(report, dependencies) {
  if (!object(report) || report.SchemaVersion !== 2 || report.ArtifactType !== 'container_image'
      || report.Metadata?.OS?.Family !== 'alpine' || !text(report.Metadata.OS.Name)
      || (Object.hasOwn(report.Metadata.OS, 'EOSL') && report.Metadata.OS.EOSL !== false)
      || !Array.isArray(report.Results) || !report.Results.length) reject('INVALID_REPORT');
  let osResults = 0, packageCount = 0;
  const nodePackages = new Set();
  for (const result of report.Results) {
    if (!object(result) || !text(result.Target) || !Array.isArray(result.Packages) || !result.Packages.length
        || !['os-pkgs', 'lang-pkgs'].includes(result.Class)) reject('MISSING_INVENTORY');
    if (result.Class === 'os-pkgs') {
      if (result.Type !== 'alpine') reject('INVALID_OS_INVENTORY');
      osResults++;
    }
    if (Object.hasOwn(result, 'Vulnerabilities') && (!Array.isArray(result.Vulnerabilities) || result.Vulnerabilities.length)) reject('VULNERABILITIES_PRESENT');
    if (Object.hasOwn(result, 'ExperimentalModifiedFindings') && (!Array.isArray(result.ExperimentalModifiedFindings) || result.ExperimentalModifiedFindings.length)) reject('SUPPRESSED_FINDINGS');
    for (const pkg of result.Packages) {
      if (!object(pkg) || !text(pkg.Name) || !text(pkg.Version)) reject('INVALID_PACKAGE');
      if (pkg.Name === 'typescript' || pkg.Name.startsWith('@typescript/')) reject('BUILD_COMPILER_IN_RUNTIME');
      packageCount++;
      if (result.Class === 'lang-pkgs' && result.Type === 'node-pkg') nodePackages.add(`${pkg.Name}@${pkg.Version}`);
    }
  }
  if (!osResults) reject('MISSING_OS_INVENTORY');
  for (const [name, version] of Object.entries(dependencies)) {
    if (!text(version) || !nodePackages.has(`${name}@${version}`)) reject('MISSING_RUNTIME_DEPENDENCY:' + name);
  }
  return { passed: true, results: report.Results.length, packages: packageCount, directDependenciesVerified: Object.keys(dependencies).length, vulnerabilities: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) reject('UNEXPECTED_ARGUMENT');
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const report = JSON.parse(readFileSync(new URL('../output/image-security.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(validateImageReport(report, manifest.dependencies)));
}
