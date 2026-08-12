import checkExportCollisions from '../commands/check-library-collisions.js';
import { Library, Script } from '../index.js';
import { cachedFetch } from './cachedFetch.js';

export async function checkLibraries({ parseScripts = false }) {
  await checkLibraryHomepagePaths();
  await checkLibraryImportPaths({ parseScripts });
  await findMinimizedImportPathAlternatives();
  await checkExportCollisions();
}

export async function checkLibraryHomepagePaths() {
  const homepages = await Promise.all(
    Library.all.map((library) => cachedFetch(library.homepage))
  );
  const invalid = Library.all.filter((_library, i) => {
    const homepage = homepages[i];
    return homepage.status !== 200;
  });
  if (invalid.length) {
    console.log(`${invalid.length} invalid library homepage paths:`);
    for (const library of invalid) console.log(library.homepage);
    console.log();
    process.exitCode = 1;
  }
}

export async function checkLibraryImportPaths({ parseScripts = false }) {
  const missingImportPaths = Library.all.filter(
    (library) => library.inference === 'automatic' && !library.importPath
  );
  if (missingImportPaths.length) {
    console.log(`These libraries are missing import paths:`);
    for (const library of missingImportPaths) {
      console.log(' ', `${library.name} (${library.homepage})`);
    }
    console.log();
    process.exitCode = 1;
  }

  const librariesWithPaths = Library.all.filter(
    (library) => library.importPath
  );
  const responses = await Promise.all(
    librariesWithPaths.map(async (library) => {
      const res = await cachedFetch(library.importPath!);
      return {
        library,
        ok: res.ok,
        text: res.ok ? await res.text() : undefined,
      };
    })
  );

  const invalidImportPaths = responses.filter((res) => !res.ok);
  if (invalidImportPaths.length) {
    console.log(`These library import paths are invalid:`);
    for (const { library } of invalidImportPaths) {
      console.log(
        `  ${library.name} (${library.homepage}) – ${library.importPath}`
      );
    }
    console.log();
    process.exitCode = 1;
  }

  if (parseScripts) {
    const libraryScripts = responses
      .filter((res) => res.ok)
      .map(({ library, text }): [Library, Script] => [
        library,
        Script.fromSource(text!),
      ]);
    const scriptErrors = libraryScripts.filter(
      ([, script]) => script.getErrors().length > 0
    );

    for (const [library, script] of scriptErrors) {
      console.log(`${library.name}:`, library.importPath);
      for (const err of script.getErrors()) {
        console.log(' ', err.message);
      }
    }
    if (scriptErrors.length) {
      console.log();
      process.exitCode = 1;
    }
  }

  // for (const [library, script] of libraryScripts.filter(([, script]) => !script.getErrors().length)) {
  //   const globals = Array.from(script.globals.keys());
  //   if (globals.length > 0) {
  //     console.log(library.name + ':', globals.join(', '));
  //   } else {
  //     console.log(library.name + ':', 'none');
  //   }
  // }
}

export async function findMinimizedImportPathAlternatives() {
  const candidates = Library.all.filter(
    (library) =>
      library.importPath?.endsWith('.js') &&
      !library.importPath.endsWith('.min.js')
  );
  const found = (
    await Promise.all(
      candidates.map(async (library): Promise<[Library, string] | null> => {
        const url = library.importPath!.replace(/\.js$/, '.min.js');
        const res = await cachedFetch(url);
        return res.ok ? [library, url] : null;
      })
    )
  ).filter((result) => result !== null);

  if (found.length) {
    console.log('These libraries have minimized alternatives:');
    for (const [library, replacement] of found) {
      console.log(`${library.name}\n  ${library.importPath} -> ${replacement}`);
    }
    console.log();
  }
}
