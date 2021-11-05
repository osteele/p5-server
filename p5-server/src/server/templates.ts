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
import { escapeHTML } from '../helpers';

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
  }
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
  [error]: SyntaxError[],
  filepath: string
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { line: errorLine, column } = (error as any).loc;
  let lines = fs.readFileSync(filepath, 'utf-8').split('\n');
  const lineNumberColWidth = String(lines.length + 1).length + 2;
  lines = lines.map((line, index) => {
    let lineLabel = String(1 + index);
    lineLabel = ' '.repeat(lineNumberColWidth - lineLabel.length) + lineLabel;
    if (1 + index === errorLine) {
      lineLabel = '<span style="color:red">▶︎</span> ' + lineLabel.slice(2);
    }
    return `${lineLabel} │ ${escapeHTML(line)}`;
  });
  lines.splice(
    errorLine,
    0,
    ' '.repeat(lineNumberColWidth + 1) +
      '│' +
      ' '.repeat(column + 1) +
      `<span style="color:red">▲</span>`
  );
  lines.splice(errorLine + 5);
  lines.splice(0, errorLine - 5);
  const contextHtml = syntaxErrorTemplate({
    error,
    filepath: path.resolve(filepath),
    context: lines.join('\n')
  });
  return jsTemplateEnv.renderString(syntaxErrorJsTemplate, {
    fileName: path.basename(filepath),
    error,
    contextHtml
  });
}
//#endregion
