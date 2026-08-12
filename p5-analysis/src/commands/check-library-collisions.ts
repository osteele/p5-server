import { Library, LibraryIndex } from '../index.js';

export default async function checkLibraryCollisions(
  options: { includeLegacy?: boolean } = {}
): Promise<void> {
  const definitions = new Map<string, Library[]>();
  const libraries = LibraryIndex.default
    .query({ policy: { includeLegacy: options.includeLegacy } })
    .libraries.filter((library) => library.inference === 'automatic');
  libraries.forEach((library) => {
    library.globals.forEach((name) => {
      let libs = definitions.get(name);
      if (!libs) {
        libs = [];
        definitions.set(name, libs);
      }
      libs.push(library);
    });
  });

  const collisions = new Set<string>();
  definitions.forEach((libs, name) => {
    if (libs.length > 1) {
      collisions.add(name);
    }
  });
  if (collisions.size === 0) {
    console.log('No collisions found');
  } else {
    console.log(`${collisions.size} collision(s) found:`);
    collisions.forEach((name) => {
      console.log(
        `${name} implies all of:`,
        definitions
          .get(name)!
          .map((lib) => lib.name)
          .join(', ')
      );
    });
  }
}
