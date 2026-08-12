import { addScriptsToHtmlHead, type HtmlHeadScript } from '../helpers.js';
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
  return addScriptsToHtmlHead(html, agentSupportHeadScripts(settings));
}

export function agentSupportHeadScripts(
  settings: AgentSupportSettings = {}
): HtmlHeadScript[] {
  return [
    {
      source: `${staticAssetPrefix}/agent-support.min.js`,
      prepend: true,
    },
    {
      source: { __p5_server_agent_settings: settings },
      prepend: true,
    },
  ];
}
