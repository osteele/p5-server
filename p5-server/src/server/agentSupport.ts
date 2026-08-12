import { addScriptToHtmlHead } from '../helpers.js';
import { staticAssetPrefix } from './constants.js';

export type AgentSupportSettings = {
  canvasDimensions?: { width: number; height: number };
  pixelDensity?: number;
  seed?: number;
};

export function injectAgentSupport(
  html: string,
  settings: AgentSupportSettings = {}
): string {
  html = addScriptToHtmlHead(
    html,
    `${staticAssetPrefix}/agent-support.min.js`,
    { prepend: true }
  );
  return addScriptToHtmlHead(
    html,
    { __p5_server_agent_settings: settings },
    { prepend: true }
  );
}
