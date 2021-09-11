import fs from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';
import pug from 'pug';
import { removeTerminalCodes, terminalCodesToHtml } from '../terminalCodes';

//
// Source view
//

export const templateDir = path.join(__dirname, './templates');

export const sourceViewTemplate = pug.compileFile(
  path.join(templateDir, 'source-view.pug')
);

//
// Syntax error
//

export const syntaxErrorTemplate = pug.compileFile(
  path.join(templateDir, 'syntax-error.pug')
);

const jsTemplateEnv = new nunjucks.Environment(null, { autoescape: false });
jsTemplateEnv.addFilter('quote', JSON.stringify);

const syntaxErrorJsTemplate = fs.readFileSync(
  path.join(templateDir, 'report-syntax-error.js.njk'),
  'utf-8'
);

export function createSyntaxErrorJsReporter(
  errs: SyntaxError[],
  filepath: string
): string {
  const [message, context] = errs[0].message.split('\n\n', 2);
  const errorHtml = syntaxErrorTemplate({
    message,
    context: terminalCodesToHtml(context, true).replace(/\n/g, '<br>')
  });
  return jsTemplateEnv.renderString(syntaxErrorJsTemplate, {
    fileName: path.basename(filepath),
    message: removeTerminalCodes(errs[0].message),
    errorHtml
  });
}
