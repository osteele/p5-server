#!/usr/bin/env ts-node
// import fetch = require('node-fetch');
import fetch from 'node-fetch';
import { JavaScriptSyntaxError, Library, Script } from '../src';

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
        const response = await fetch(library.importPath!);
        if (!response.ok) {
          console.error(
            `Failed to retrieve ${library.importPath} for ${library.name}`,
            response.status,
            response.statusText
          );
        }
        return [library.name, response.ok ? await response.text() : null];
      })
    )
  );
  for (const library of librariesWithPaths) {
    const text = responses[library.name];
    if (!text) continue;
    // console.log(`${library.name}: ${text.replace(/\n/g, ' ').slice(0, 50)}...`);
    console.log(`${library.name}:`, library.importPath);
    for (const err of Script.fromSource(text).getErrors()) {
      console.log(' ', err.message);
    }
  }
}

testPaths();
