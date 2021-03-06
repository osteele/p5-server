import nunjucks from 'nunjucks';
import { Library } from '..';
import { die } from './helpers';
import { exec } from 'child_process';

export function configureNunjucks() {
  nunjucks.configure(`${__dirname}/templates`, { autoescape: false });
}

export function describeLibrary(name: string, { json = false }) {
  configureNunjucks();
  const library = Library.find({ name });
  if (!library) {
    console.warn(`Library ${name} not found`);
    process.exit(1);
  }
  if (json) {
    console.log(JSON.stringify(library, null, 2));
  } else {
    console.log(nunjucks.render('library.njk', { library }));
  }
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

export function listLibraries({ json = false, verbose = false }) {
  configureNunjucks();
  if (json) {
    console.log(JSON.stringify(Library.all, null, 2));
  } else if (verbose) {
    console.log(
      nunjucks.render('list-libraries.njk', {
        libraries: Library.all,
        categories: Library.categories
      })
    );
  } else {
    console.log(Library.all.map(l => l.name).join('\n'));
  }
}

export async function updateDescriptions() {
  const libs = Library.all.filter(lib => lib.packageName);
  const packageDescriptions = await Promise.all(
    libs.map(
      lib =>
        new Promise((resolve, reject) =>
          exec(
            `npm view --json ${lib.packageName} description`,
            {
              encoding: 'utf-8'
            },
            (error, stdout) => (error ? reject(error) : resolve(JSON.parse(stdout)))
          )
        )
    )
  );

  libs.forEach((lib, i) => {
    const packageDescription = packageDescriptions[i];
    if (lib.description !== packageDescription) {
      console.log(`${lib.name}:`);
      console.log(`Library file description = ${JSON.stringify(lib.description)} !=`);
      console.log(` npm package description = ${JSON.stringify(packageDescription)}\n`);
    }
  });
}
