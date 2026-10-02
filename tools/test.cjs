const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const creatorRoot = process.env.COCOS_CREATOR_ROOT || 'C:/ProgramData/cocos/editors/Creator/3.8.8';
const tsPath = path.join(creatorRoot, 'resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
if (!fs.existsSync(tsPath)) throw new Error('Installed Creator TypeScript compiler not found; no package will be installed automatically.');
const ts = require(tsPath);
const sourceDir = path.join(root, 'project/assets/scripts');
const evidence = path.join(root, 'evidence');
fs.mkdirSync(evidence, { recursive: true });
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(path.join(directory, e.name)) : e.name.endsWith('.ts') ? [path.join(directory, e.name)] : []);
}
function check(names, options, title) {
  const program = ts.createProgram(names, options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const text = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }).replace(/\x1b\[[0-9;]*m/g, '');
  if (diagnostics.length) { fs.writeFileSync(path.join(evidence, 'typecheck.log'), text); throw new Error(text); }
  if (!options.noEmit) program.emit();
  return `${title}: PASS (${names.length} source/type inputs; TypeScript ${ts.version})`;
}
const options = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true,
  experimentalDecorators: true, useDefineForClassFields: false, skipLibCheck: true,
  rootDir: sourceDir, outDir: path.join(root, '.test-dist'), noEmitOnError: true };
const sourceFiles = files(sourceDir);
const coreFiles = sourceFiles.filter(f => !f.endsWith('QuizApp.ts') && !f.endsWith('cocos-platform.ts') && !f.endsWith('ComicUI.ts') && !f.endsWith('ComicArt.ts'));
const ccTypes = path.join(creatorRoot, 'resources/resources/3d/engine/bin/.declarations/cc.d.ts');
const messages = [check(coreFiles, options, 'Core/platform compile'),
  check([...sourceFiles, ccTypes], { ...options, noEmit: true }, 'Cocos API typecheck')];
fs.writeFileSync(path.join(evidence, 'typecheck.log'), messages.join('\n') + '\n');
console.log(messages.join('\n'));
// Register node:test tests in this process. No child process creation is needed.
require(path.join(root, 'tests/verification.test.cjs'));
require(path.join(root, 'tests/first-playable.test.cjs'));
require(path.join(root, 'tests/art-assets.test.cjs'));
require(path.join(root, 'tests/replay.test.cjs'));
require(path.join(root, 'tests/content-v02.test.cjs'));
