import nunjucks from 'nunjucks';
import path from 'path';
import { Library } from 'p5-analysis';

export default function reportLibraries() {
  const templatePath = path.join(__dirname, './templates/report-libraries.njk');

  const definitions = new Map<string, Library[]>();
  Library.all.forEach(library => {
    library.globals.forEach(name => {
      let libs = definitions.get(name);
      if (!libs) {
        libs = [];
        definitions.set(name, libs);
      }
      libs.push(library);
    });
  });

  console.log(
    nunjucks.render(templatePath, {
      definitions,
      libraries: Library.all
    })
  );
}
