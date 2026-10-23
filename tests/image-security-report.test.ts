import { expect, it } from 'vitest';
import { validateImageReport } from '../scripts/check-image-security.mjs';

const report = () => ({SchemaVersion:2,ArtifactType:'container_image',Metadata:{OS:{Family:'alpine',Name:'3.24',EOSL:false}},Results:[
  {Target:'alpine',Class:'os-pkgs',Type:'alpine',Packages:[{Name:'musl',Version:'1.2.6'}]},
  {Target:'node',Class:'lang-pkgs',Type:'node-pkg',Packages:[{Name:'example',Version:'1.0.0'}]},
]});
it('requires OS and complete direct runtime inventory', () => {
  expect(validateImageReport(report(), {example:'1.0.0'}).passed).toBe(true);
  expect(() => validateImageReport(report(), {missing:'1.0.0'})).toThrow(/MISSING_RUNTIME_DEPENDENCY/);
  const empty = report(); empty.Results=[];
  expect(() => validateImageReport(empty, {})).toThrow(/INVALID_REPORT/);
  const noOs = report(); noOs.Results=noOs.Results.slice(1);
  expect(() => validateImageReport(noOs, {})).toThrow(/MISSING_OS_INVENTORY/);
});
it('rejects findings, suppressions and development compilers', () => {
  const vulnerable = report(); Object.assign(vulnerable.Results[0], {Vulnerabilities:[{Severity:'LOW',FixedVersion:''}]});
  expect(() => validateImageReport(vulnerable, {})).toThrow(/VULNERABILITIES_PRESENT/);
  const hidden = report(); Object.assign(hidden.Results[0], {ExperimentalModifiedFindings:[{}]});
  expect(() => validateImageReport(hidden, {})).toThrow(/SUPPRESSED_FINDINGS/);
  const compiler = report(); compiler.Results[1].Packages=[{Name:'typescript',Version:'7.0.2'}];
  expect(() => validateImageReport(compiler, {})).toThrow(/BUILD_COMPILER_IN_RUNTIME/);
});
