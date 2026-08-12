import { parse } from 'node-html-parser';
import * as templates from '../src/server/templates';

// @ponicode
describe('templates.markdownToHtmlPage', () => {
  test('renders markdown', () => {
    const result: string = templates.markdownToHtmlPage('Markdown _here_');
    expect(result).toContain('Markdown');
  });

  test('renders smart quotes', () => {
    const result: string = templates.markdownToHtmlPage("with 'fancy quotes'");
    expect(parse(result).text).toContain('with ‘fancy quotes’');
  });

  test('uses h1 as the page title', () => {
    const result: string = templates.markdownToHtmlPage('# Page title');
    expect(result).toContain('<title>Page title</title>');
  });
});
