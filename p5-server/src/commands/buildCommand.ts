import fs from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { minimatch } from 'minimatch';
import open from 'open';
import { Sketch } from 'p5-analysis';
import {
  assertPortableRelativePath,
  die,
  pathIsInDirectory,
  pathIsMarkdown,
  portablePathKey,
  stringToOptions,
} from '../helpers.js';
import {
  createDirectoryListing,
  defaultDirectoryExclusions,
} from '../server/directoryListing.js';
import { markdownToHtmlPage, sourceViewTemplate } from '../server/templates.js';

// TODO: copy the static icons into the build directory

type Options = {
  options: string;
  output: string;
  theme: string;
  dryRun?: boolean;
  open?: boolean;
  verbose?: boolean;
};

const directoryExclusions = [...defaultDirectoryExclusions, 'build'];

export default async function build(source: string, options: Options) {
  const output = path.resolve(options.output);
  const resolvedSource = path.resolve(source);
  const hrstart = process.hrtime.bigint();

  if (options.theme === 'directory') {
    options.theme = 'grid';
    process.stderr.write(
      chalk.yellow(
        'The "directory" theme has been renamed to grid. A future release will remove the "directory" value.\n'
      )
    );
  }

  assertTreeHasNoSymbolicLinks(resolvedSource);
  const outputStat = lstatIfExists(output);
  if (outputStat?.isSymbolicLink()) {
    throw new Error(`Build output directory is a symbolic link: ${output}`);
  }
  if (outputStat && !outputStat.isDirectory()) {
    throw new Error(`Build output is not a directory: ${output}`);
  }

  const canonicalSource = fs.realpathSync(resolvedSource);
  const canonicalOutput = resolveThroughExistingAncestor(output);
  if (
    pathIsInDirectory(canonicalOutput, canonicalSource) &&
    !directoryExclusions.some((pattern) =>
      minimatch(path.relative(canonicalSource, canonicalOutput), pattern)
    )
  ) {
    die('The output directory cannot be inside the source directory');
  }
  if (pathIsInDirectory(canonicalSource, canonicalOutput)) {
    die('The source directory cannot be inside the output directory');
  }

  let count: number;
  if (options.dryRun) {
    const actions: Action[] = [];
    for await (const action of createActions(resolvedSource, output)) {
      actions.push(action);
    }
    assertOutputPathsInDirectory(actions, output);
    assertDistinctOutputPaths(actions, output);
    count = await runActions(actions, options);
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const staging = fs.mkdtempSync(
      path.join(path.dirname(output), `.${path.basename(output)}-p5-build-`)
    );
    const actions: Action[] = [];
    try {
      for await (const action of createActions(resolvedSource, staging)) {
        actions.push(action);
      }
      assertOutputPathsInDirectory(actions, staging);
      assertDistinctOutputPaths(actions, staging);
      count = await runActions(actions, options);
      replaceBuildOutput(staging, output);
    } finally {
      await rm(staging, { force: true, recursive: true });
    }
  }

  const rootIndex = path.join(output, 'index.html');
  const elapsed = Number(process.hrtime.bigint() - hrstart) / 1e6;
  console.log(
    `p5 build wrote ${count} files to directory ${output} in ${elapsed.toFixed(2)}ms`
  );
  if (options.open) {
    open(rootIndex);
  } else if (options.verbose) {
    console.log(`Open file://${path.resolve(rootIndex)} to view`);
  }
}

function lstatIfExists(filepath: string): fs.Stats | null {
  try {
    return fs.lstatSync(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function resolveThroughExistingAncestor(filepath: string): string {
  const suffix: string[] = [];
  let current = path.resolve(filepath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(filepath);
    suffix.unshift(path.basename(current));
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...suffix);
}

function assertTreeHasNoSymbolicLinks(root: string): void {
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) {
    throw new Error(`Build source contains a symbolic link: ${root}`);
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (directoryExclusions.some((pattern) => minimatch(entry.name, pattern))) {
      continue;
    }
    const filepath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Build source contains a symbolic link: ${filepath}`);
    }
    if (entry.isDirectory()) assertTreeHasNoSymbolicLinks(filepath);
  }
}

function assertOutputPathsInDirectory(
  actions: readonly Action[],
  output: string
): void {
  for (const action of actions) {
    if (!pathIsInDirectory(action.outputFile, output)) {
      throw new Error(
        `Generated path escapes the build output directory: ${action.outputFile}`
      );
    }
  }
}

function replaceBuildOutput(staging: string, output: string): void {
  const outputStat = lstatIfExists(output);
  if (!outputStat) {
    fs.renameSync(staging, output);
    return;
  }
  if (outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
    throw new Error(`Build output is not a regular directory: ${output}`);
  }

  const backup = fs.mkdtempSync(
    path.join(path.dirname(output), `.${path.basename(output)}-p5-backup-`)
  );
  const oldEntries = fs
    .readdirSync(output)
    .filter((name) => !name.startsWith('.'));
  const newEntries = fs.readdirSync(staging);
  const movedOld: string[] = [];
  const movedNew: string[] = [];
  let keepBackup = false;
  try {
    for (const name of oldEntries) {
      fs.renameSync(path.join(output, name), path.join(backup, name));
      movedOld.push(name);
    }
    for (const name of newEntries) {
      fs.renameSync(path.join(staging, name), path.join(output, name));
      movedNew.push(name);
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const name of movedNew.reverse()) {
      try {
        fs.renameSync(path.join(output, name), path.join(staging, name));
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const name of movedOld.reverse()) {
      try {
        fs.renameSync(path.join(backup, name), path.join(output, name));
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      keepBackup = true;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Could not restore the previous build output; backup retained at ${backup}`
      );
    }
    throw error;
  } finally {
    if (!keepBackup) fs.rmSync(backup, { force: true, recursive: true });
  }
}

type Action = (
  | { kind: 'copyDir'; source: string }
  | { kind: 'copyFile'; source: string }
  | { kind: 'mkdir'; source: string }
  | { kind: 'convertMarkdown'; source: string }
  | { kind: 'createIndex'; dir: string; path: string }
  | { kind: 'createSketchHtml'; sketch: Sketch }
  | { kind: 'createSourceView'; source: string }
) & { outputFile: string };

type ActionIterator = AsyncIterableIterator<Action>;

function assertDistinctOutputPaths(
  actions: readonly Action[],
  outputRoot: string
): void {
  const outputs = new Map<string, Action>();
  for (const action of actions) {
    for (const outputFile of actionOutputPaths(action)) {
      const resolvedOutput = path.resolve(outputFile);
      const key = portablePathKey(resolvedOutput);
      const previous = outputs.get(key);
      if (previous) {
        throw new Error(
          `Build output collision at ${resolvedOutput}: ${describeAction(previous)} and ${describeAction(action)}`
        );
      }
      assertPortableRelativePath(path.relative(outputRoot, resolvedOutput));
      outputs.set(key, action);
    }
  }

  function describeAction(action: Action): string {
    if ('source' in action) return `${action.kind} from ${action.source}`;
    if (action.kind === 'createSketchHtml') {
      return `${action.kind} from ${action.sketch.scriptFilePath}`;
    }
    return `${action.kind} for ${action.dir}`;
  }
}

function* actionOutputPaths(action: Action): Generator<string> {
  yield action.outputFile;
  if (action.kind !== 'copyDir') return;
  yield* copiedDirectoryOutputPaths(action.source, action.outputFile);
}

function* copiedDirectoryOutputPaths(
  source: string,
  output: string
): Generator<string> {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!shouldCopyEntry(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const outputPath = path.join(output, entry.name);
    yield outputPath;
    if (entry.isDirectory()) {
      yield* copiedDirectoryOutputPaths(sourcePath, outputPath);
    }
  }
}

function shouldCopyEntry(name: string): boolean {
  return !directoryExclusions.some((pattern) => minimatch(name, pattern));
}

function Action(
  kind: 'convertMarkdown' | 'copyDir' | 'copyFile' | 'mkdir',
  source: string,
  outputFile: string
): Action {
  return { kind, source, outputFile };
}

function createActions(file: string, output: string): ActionIterator {
  return visit(file, output);

  async function* visit(source: string, output: string): ActionIterator {
    if (fs.statSync(source).isDirectory()) {
      yield* visitDir(source, output);
    } else {
      yield Action('copyFile', source, output);
      if (pathIsMarkdown(source)) {
        yield Action('convertMarkdown', source, `${output}.html`);
      }
    }
  }

  async function* visitDir(dir: string, output: string): ActionIterator {
    const { sketches, allFiles } = await Sketch.analyzeDirectory(dir, {
      exclusions: directoryExclusions,
    });
    yield Action('mkdir', dir, output);

    const subdirectorySketches = sketches.filter((sk) => sk.dir !== dir);
    for (const sketch of subdirectorySketches) {
      yield Action(
        'copyDir',
        sketch.dir,
        path.join(output, path.relative(dir, sketch.dir))
      );
    }

    const scriptOnlySketches = sketches.filter(
      (sk) => sk.structureType === 'script'
    );
    for (const sketch of scriptOnlySketches) {
      const outputFile = path
        .join(output, path.relative(dir, sketch.dir), sketch.scriptFile)
        .replace(/\.js$/i, '.html');
      yield { kind: 'createSketchHtml', sketch, outputFile };
    }

    // Do this after the directories are copied
    for (const sketch of sketches) {
      const outputFile = path
        .join(output, path.relative(dir, sketch.scriptFilePath))
        .replace(/\.js$/i, '.js.html');
      yield {
        kind: 'createSourceView',
        source: sketch.scriptFilePath,
        outputFile,
      };
    }

    for (const file of allFiles) {
      yield* visit(path.join(dir, file), path.join(output, file));
    }

    if (!allFiles.find((file) => /^index\.html?$/i.test(file))) {
      // Generate the index from the target, rather than the source, so that it
      // will refer to generated HTML files instead of the bare JavaScript
      // sketches.
      const outputFile = path.join(output, 'index.html');
      // construct the listing from the output directory, because it contains
      // the generated sketch HTML files
      yield {
        kind: 'createIndex',
        dir,
        outputFile,
        path: path.basename(dir),
      };
    }
  }
}

async function runActions(
  actions: Iterable<Action> | AsyncIterable<Action>,
  options: Options
) {
  let filesCreated = 0;
  for await (const action of actions) {
    if (options.verbose || options.dryRun) {
      const args = actionMessageArgs(action);
      if (args) console.log(...args);
    }
    if (!options.dryRun) {
      const { filesCreated: n } = await runAction(action);
      filesCreated += n;
    }
  }
  return filesCreated;

  function actionMessageArgs(action: Action) {
    const { outputFile } = action;
    switch (action.kind) {
      case 'copyDir':
        return ['Copy directory', action.source, '->', outputFile];
      case 'copyFile':
        return ['Copy file', action.source, '->', outputFile];
      case 'convertMarkdown':
        return ['Convert', action.source, '->', outputFile];
      case 'createIndex':
        return ['Generate directory listing', outputFile];
      case 'createSketchHtml':
        return [
          'Generate sketch HTML',
          action.sketch.scriptFile,
          '->',
          outputFile,
        ];
      case 'createSourceView':
        return ['Create source view', action.source, '->', outputFile];
      case 'mkdir':
        if (!fs.existsSync(outputFile)) {
          return ['Create directory', outputFile];
        }
        break;
    }
  }

  async function runAction(action: Action) {
    const { outputFile } = action;
    let filesCreated = 0;
    switch (action.kind) {
      case 'copyDir':
        fs.cpSync(action.source, outputFile, {
          recursive: true,
          filter(sourcePath) {
            if (sourcePath === action.source) return true;
            const allowed = shouldCopyEntry(path.basename(sourcePath));
            if (allowed && !fs.lstatSync(sourcePath).isDirectory()) {
              filesCreated += 1;
            }
            return allowed;
          },
        });
        break;
      case 'copyFile':
        fs.copyFileSync(action.source, outputFile);
        filesCreated += 1;
        break;
      case 'convertMarkdown': {
        const html = markdownToHtmlPage(
          fs.readFileSync(action.source, 'utf-8')
        );
        fs.writeFileSync(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createIndex': {
        const { dir, path } = action;
        fs.rmSync(outputFile, { force: true });
        const templateOptions = stringToOptions(options.options);
        const html = await createDirectoryListing(dir, path, {
          staticMode: true,
          templateName: options.theme,
          templateOptions,
        });
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createSketchHtml': {
        const { sketch } = action;
        const html = await sketch.getHtmlContent();
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'createSourceView': {
        const source = fs.readFileSync(action.source, 'utf-8');
        const title = path.basename(action.source);
        const html = sourceViewTemplate({ source, title });
        await writeFile(outputFile, html);
        filesCreated += 1;
        break;
      }
      case 'mkdir':
        fs.mkdirSync(outputFile, { recursive: true });
        break;
    }
    return { filesCreated };
  }
}
