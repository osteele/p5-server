import * as templates from '../src/server/templates';
// @ponicode
describe('templates.markdownToHtmlPage', () => {
  test('renders markdown', () => {
    let result: string = templates.markdownToHtmlPage('Markdown _here_');
    expect(result).toContain('Markdown');
  });

  test('renders smart quotes', () => {
    let result: string = templates.markdownToHtmlPage("with 'fancy quotes'");
    expect(result).toContain('with ‘fancy quotes’');
  });

  test('uses h1 as the page title', () => {
    let result: string = templates.markdownToHtmlPage('# Page title');
    expect(result).toContain('<title>Page title</title>');
  });
});
