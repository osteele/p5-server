// TODO: merge these with the types in consoleRelayTypes.ts

export type ConsoleLogLevel = 'debug' | 'error' | 'info' | 'log' | 'warn';

export type BrowserConsoleEventMethods = 'clear' | ConsoleLogLevel;

export type BrowserEventCommon = {
  clientId: string;
  file?: string;
  timestamp: Date;
  url: string;
};

export type BrowserConnectionEvent = {
  type: 'opened';
} & BrowserEventCommon;

export type BrowserConsoleEvent = {
  type: 'console';
  method: BrowserConsoleEventMethods;
  args: unknown[];
  argStrings: (string | null)[];
  col?: number;
  line?: number;
} & BrowserEventCommon;

export type BrowserDocumentEvent = {
  type: 'visibilitychange';
  visibilityState: 'hidden' | 'visible';
} & BrowserEventCommon;

export type BrowserErrorEvent = (
  | { type: 'error'; line?: number; col?: number }
  | { type: 'unhandledRejection' }
) & {
  message: string;
  stack?: string;
} & BrowserEventCommon;

export type BrowserWindowEvent = {
  type: 'DOMContentLoaded' | 'load' | 'pagehide';
} & BrowserEventCommon;

export type BrowserEventMessage =
  | BrowserConnectionEvent
  | BrowserConsoleEvent
  | BrowserDocumentEvent
  | BrowserErrorEvent
  | BrowserWindowEvent;
