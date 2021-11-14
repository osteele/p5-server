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

export const templateDir = path.join(__dirname, './templates');

hljs.registerLanguage('css', hljscss);
hljs.registerLanguage('javascript', hljsjavascript);
hljs.registerLanguage('plaintext', hljsplaintext);
hljs.registerLanguage('shell', hljsshell);

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

class SyntaxErrorFormatter {
  private static readonly jsTemplateEnv = new nunjucks.Environment(null, {
    autoescape: false
  });

  private static readonly syntaxErrorTemplate = pug.compileFile(
    path.join(templateDir, 'syntax-error.pug')
  );

  private static readonly syntaxErrorJsTemplate = fs.readFileSync(
    path.join(templateDir, 'report-syntax-error.js.njk'),
    'utf-8'
  );

  static {
    this.jsTemplateEnv.addFilter('quote', JSON.stringify);
  }

  render(filepath: string, error: SyntaxError): string {
    const {jsTemplateEnv,syntaxErrorTemplate,syntaxErrorJsTemplate} = SyntaxErrorFormatter;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { line: lineNo, column } = (error as any).loc;
    let message = error.message;
    const locationSuffix = ` (${lineNo}:${column})`
    if (message.endsWith(locationSuffix)) {
      message = message.slice(0, -locationSuffix.length);
    }

    // extract, escape, and number the lines
    let lines = fs.readFileSync(filepath, 'utf-8').trimEnd().split('\n');
    const lineNumberColWidth = String(lines.length + 1).length + 2;
    lines = lines.map((line, index) => {
      let lineLabel = String(1 + index);
      lineLabel = ' '.repeat(lineNumberColWidth - lineLabel.length) + lineLabel;
      if (1 + index === lineNo) {
        lineLabel = '<span style="color:red">▶︎</span> ' + lineLabel.slice(2);
      }
      return `${lineLabel} │ ${escapeHTML(line)}`;
    });

    // add a line beneath the error line
    lines.splice(
      lineNo,
      0,
      ' '.repeat(lineNumberColWidth + 1) +
        '│' +
        ' '.repeat(column + 1) +
        `<span style="color:red">▲</span>`
    );

    const contextWindow = 8;
    // window the lines to the context around the error line
    lines.splice(lineNo + contextWindow);
    lines.splice(0, lineNo - contextWindow);

    // render HTML
    const contextHtml = syntaxErrorTemplate({
      error: {...error, message},
      filepath,
      fullpath: path.resolve(filepath),
      context: lines.join('\n')
    });

    // return JS that will set the page body to the HTML
    return jsTemplateEnv.renderString(syntaxErrorJsTemplate, {
      fileName: path.basename(filepath),
      error,
      contextHtml
    });
  }
}

export function createSyntaxErrorJsReporter(
  filepath: string,
  [error]: SyntaxError[],
): string {
  return new SyntaxErrorFormatter().render(filepath, error);
}
