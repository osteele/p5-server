#!/usr/bin/env ts-node
// import fetch = require('node-fetch');
import fetch from 'node-fetch';
import { Library, Script } from '../src';

async function testPaths() {
  const missingImportPaths = Library.all.filter(library => !library.importPath);
  if (missingImportPaths.length) {
    console.log(`The following libraries don't have an import path:`);
    missingImportPaths.forEach(library => console.log(library.name));
    console.log();
  }

  console.info('Fetching sources...');
  const librariesWithPaths = Library.all.filter(library => library.importPath);
  const responses = Object.fromEntries(
    await Promise.all(
      librariesWithPaths.map(async function(library) {
        const res = await fetch(library.importPath!);
        if (!res.ok) {
          console.error(`Failed to retrieve ${library.importPath} for ${library.name}`, res.status, res.statusText);
        }
        return [library.name, res.ok ? await res.text() : null];
      })
    )
  );
  for (const library of librariesWithPaths) {
    const text = responses[library.name];
    if (!text) continue;
    console.log(`${library.name}:`, library.importPath);
    for (const err of Script.fromSource(text).getErrors()) {
      console.log(' ', err.message);
    }
  }
}

testPaths();
