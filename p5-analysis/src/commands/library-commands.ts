#!/usr/bin/env ts-node
import nunjucks from 'nunjucks';
import { Library } from '..';
import { die } from './helpers';

nunjucks.configure(`${__dirname}/templates`, { autoescape: false });

export function describeLibrary(name: string) {
  const library = Library.find({ name });
  if (!library) {
    console.warn(`Library ${name} not found`);
    process.exit(1);
  }
  console.log(nunjucks.render('library.njk', { library }));
}

export function printLibraryProperty(
  name: string,
  propertyName: string,
  { html = false }
) {
  const library = Library.find({ name });
  if (!library) {
    console.warn(`Library ${name} not found`);
    process.exit(1);
  }
  if (propertyName !== 'import-path') {
    die(`Property ${propertyName} not found`);
  }
  console.log(
    html ? `<script src="${library.importPath}"></script>` : library.importPath
  );
}

export function listLibraries({ verbose = false }) {
  if (!verbose) {
    console.log(Library.all.map(l => l.name).join('\n'));
    return;
  }
  console.log(
    nunjucks.render('list-libraries.njk', {
      libraries: Library.all,
      categories: Library.categories,
    })
  );
}
