// eslint-disable-next-line @typescript-eslint/no-explicit-any

export type BrowserConsoleEventMethods =
  | 'clear'
  | 'debug'
  | 'error'
  | 'info'
  | 'log'
  | 'warn';

export type BrowserEventCommon = {
  clientId: string;
  file?: string;
  timestamp: Date;
  type: string;
  url: string;
};

export type BrowserConnectionEvent = {
  type: 'opened';
} & BrowserEventCommon;

export type BrowserConsoleEvent = {
  type: 'console';
  method: BrowserConsoleEventMethods;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  argStrings: (string | null)[];
  col?: number;
  line?: number;
} & BrowserEventCommon;

export type BrowserDocumentEvent = {
  type: 'visibilitychange';
  visibilityState: boolean;
} & BrowserEventCommon;

export type BrowserErrorEvent = (
  | { type: 'error'; line: number; col: number }
  | { type: 'unhandledRejection' }
) & {
  message: string;
  stack?: string;
} & BrowserEventCommon;

export type BrowserWindowEvent = {
  type: 'load' | 'DOMContentLoaded' | 'pagehide';
} & BrowserEventCommon;

export type BrowserEventMessage =
  | BrowserConnectionEvent
  | BrowserConsoleEvent
  | BrowserDocumentEvent
  | BrowserErrorEvent
  | BrowserWindowEvent;
