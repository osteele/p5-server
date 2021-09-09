import fs from 'fs';
import marked from 'marked';
import path from 'path';
import pug from 'pug';
import { Sketch } from 'p5-analysis';
import { pathComponentsForBreadcrumbs } from '../utils';
import { templateDir } from './globals';

export const defaultDirectoryExclusions = [
  '.*',
  '*~',
  'node_modules',
  'package.json',
  'package-lock.json'
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
    ...options
  };
  const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, {
    exclusions: defaultDirectoryExclusions
  });
  sketches.sort((a, b) => a.name.localeCompare(b.name));
  unassociatedFiles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const readmeName = unassociatedFiles.find(s => s.toLowerCase() === 'readme.md');
  const readme = readmeName
    ? {
        name: readmeName,
        html: marked(fs.readFileSync(path.join(dir, readmeName), 'utf-8')),
        url: staticMode ? `${readmeName}.html` : readmeName
      }
    : null;

  const directories = unassociatedFiles.filter(s =>
    fs.statSync(path.join(dir, s)).isDirectory()
  );
  const files = unassociatedFiles.filter(
    s => !directories.includes(s) && s !== readmeName
  );
  const title = dir === './' ? 'P5 Server' : path.basename(dir);

  const templatePath = ['', '.pug']
    .map(ext => path.join(templateDir, templateName + ext))
    .find(p => fs.existsSync(p));
  if (!templatePath) {
    throw new Error(`Could not find template ${templateName}`);
  }
  const pathComponents = pathComponentsForBreadcrumbs(breadcrumbPath || dir);
  return pug.renderFile(templatePath, {
    ...templateOptions,

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
    cache: true
  });

  function directory_index(dir: string) {
    return staticMode ? `${dir}/index.html` : `${dir}/`;
  }

  function markdown(md: string | null) {
    return md ? marked(md) : '';
  }

  function path_to(filepath: string, sk: Sketch) {
    return path.relative(dir, path.join(sk.dir, filepath));
  }

  function path_to_src_view(file: string, sk: Sketch) {
    let filepath = path_to(file, sk);
    if (!staticMode && filepath.match(/.*\.(html?|js)$/i)) {
      filepath += '?fmt=view';
    }
    return filepath;
  }

  function play_link(sk: Sketch) {
    return path_to(
      staticMode && sk.sketchType === 'javascript'
        ? sk.mainFile.replace(/\.js$/i, '.html')
        : sk.mainFile,
      sk
    );
  }
}
