import fs from 'fs';
import marked from 'marked';
import { Sketch } from 'p5-analysis';
import path from 'path';
import pug from 'pug';
import { pathComponentsForBreadcrumbs } from '../helpers';
import { staticAssetPrefix } from './constants';
import { markedOptions, templateDir } from './templates';

export const defaultDirectoryExclusions = [
  '.*',
  '*~', // editor backup file
  '*.log',
  'node_modules',
  'package.json',
  'package-lock.json',

  // Linux
  '~*', // backup file

  // macOS
  'Icon\r', // Custom Finder icon

  // Windows
  'Thumbs.db',
];

export async function createDirectoryListing(
  dir: string,
  breadcrumbPath?: string,
  options: Partial<{
    staticMode: boolean;
    templateName: string;
    templateOptions: Record<string, string | boolean>;
  }> = {}
): Promise<string> {
  const { staticMode, templateName, templateOptions } = {
    staticMode: false,
    templateName: 'directory.pug',
    templateOptions: {},
    ...options,
  };
  const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, {
    exclusions: defaultDirectoryExclusions,
  });
  sketches.sort((a, b) => a.name.localeCompare(b.name));
  unassociatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unassociatedFiles.find(name =>
    /^readme\.(md|mkd|mkdn|mdwn|mdown|markdown)$/i.test(name)
  );
  const readme = readmeName
    ? {
        name: readmeName,
        html: markdown(fs.readFileSync(path.join(dir, readmeName), 'utf-8')),
        url: staticMode ? `${readmeName}.html` : readmeName,
      }
    : null;

  const directories = unassociatedFiles.filter(s =>
    fs.statSync(path.join(dir, s)).isDirectory()
  );
  const files = unassociatedFiles.filter(
    s => !directories.includes(s) && s !== readmeName
  );
  const title = dir === './' ? 'P5 Server' : path.basename(dir);

  const templatePaths = ['', '.pug'].flatMap(ext => [
    path.join(templateDir, templateName + ext),
    path.join(templateDir, templateName, `directory${ext}`),
  ]);
  const templatePath = templatePaths.find(
    p => fs.existsSync(p) && !fs.statSync(p).isDirectory()
  );
  if (!templatePath) {
    throw new Error(
      `Could not find template ${templateName} in ${templatePaths.join(', ')}`
    );
  }
  const pathComponents = pathComponentsForBreadcrumbs(breadcrumbPath || dir);
  return pug.renderFile(templatePath, {
    ...templateOptions,
    staticAssetPrefix,

    directories,
    files,
    pathComponents,
    readme,
    sketches,
    title,

    // functions
    directory_index,
    path_to,
    path_to_src_view,
    markdown,
    play_link,

    // pug options
    cache: true,
    filters: { markdown },
  });

  function directory_index(dir: string) {
    return staticMode ? `${dir}/index.html` : `${dir}/`;
  }

  function markdown(md: string | null) {
    return md ? marked(md, markedOptions) : '';
  }

  function path_to(filepath: string, sk: Sketch) {
    return path.relative(dir, path.join(sk.dir, filepath));
  }

  function path_to_src_view(file: string, sk: Sketch) {
    const filepath = path_to(file, sk);
    return staticMode
      ? `${filepath}.html`
      : filepath.match(/.*\.(html?|js)$/i)
      ? `${filepath}?fmt=view`
      : filepath;
  }

  function play_link(sk: Sketch) {
    return path_to(
      staticMode && sk.structureType === 'script'
        ? sk.mainFile.replace(/\.js$/i, '.html')
        : sk.mainFile,
      sk
    );
  }
}
