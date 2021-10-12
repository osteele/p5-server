import fs from 'fs';
import hljs from 'highlight.js/lib/core';
import hljscss from 'highlight.js/lib/languages/css';
import hljsjavascript from 'highlight.js/lib/languages/javascript';
import hljsplaintext from 'highlight.js/lib/languages/plaintext';
import hljsshell from 'highlight.js/lib/languages/shell';
import marked from 'marked';
import nunjucks from 'nunjucks';
import path from 'path';
import pug from 'pug';
import { removeTerminalCodes, terminalCodesToHtml } from '../terminalCodes';

hljs.registerLanguage('css', hljscss);
hljs.registerLanguage('javascript', hljsjavascript);
hljs.registerLanguage('plaintext', hljsplaintext);
hljs.registerLanguage('shell', hljsshell);

export const templateDir = path.join(__dirname, './templates');

const markdownPageTemplate = pug.compileFile(path.join(templateDir, 'markdown.pug'));

export const markedOptions: marked.MarkedOptions = {
  smartypants: true,
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'javascript';
    return hljs.highlight(code, { language }).value;
  },
};

export function markdownToHtmlPage(data: string): string {
  const markdown = marked(data, markedOptions);
  const title = data.match(/^#\s*(.+)\s*$/m)?.[1] ?? '';
  return markdownPageTemplate({ markdown, title });
}

export const sourceViewTemplate = pug.compileFile(
  path.join(templateDir, 'source-view.pug')
);

//#region Syntax error
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
    context: terminalCodesToHtml(context, true).replace(/\n/g, '<br>'),
  });
  return jsTemplateEnv.renderString(syntaxErrorJsTemplate, {
    fileName: path.basename(filepath),
    message: removeTerminalCodes(errs[0].message),
    errorHtml,
  });
}
//#endregion
