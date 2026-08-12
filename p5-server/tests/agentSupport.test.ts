import { parse } from 'node-html-parser';
import { injectAgentSupport } from '../src/server/agentSupport';

test('agent support settings and runtime load before sketch scripts', () => {
  const html = injectAgentSupport(
    '<html><head><script src="p5.js"></script></head><body></body></html>',
    { seed: 42 }
  );
  const scripts = parse(html).querySelectorAll('script');

  expect(scripts).toHaveLength(3);
  expect(scripts[0].text).toContain('__p5_server_agent_settings');
  expect(scripts[0].text).toContain('"seed":42');
  expect(scripts[1].attributes.src).toBe(
    '/__p5_server_static/agent-support.min.js'
  );
  expect(scripts[2].attributes.src).toBe('p5.js');
});
