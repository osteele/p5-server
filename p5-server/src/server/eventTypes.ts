// eslint-disable-next-line @typescript-eslint/no-explicit-any

/** This list is not extensive. */
export type BrowserConsoleEventMethods = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'clear';

export type BrowserConnectionEvent = {
  clientId: string;
  file?: string;
  url: string;
  type: string;
};

export type BrowserConsoleEvent = {
  method: BrowserConsoleEventMethods;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  argStrings: (string | null)[];
  clientId: string;
  file?: string;
  url: string;
};

export type BrowserErrorEvent = (
  | { type: 'error'; line: number; col: number; url: string }
  | { type: 'unhandledRejection' }
) & {
  type: string;
  clientId: string;
  file?: string;
  url: string;
  message: string;
  stack?: string;
};

export type BrowserWindowEvent = {
  type: string;
  clientId: string;
  file?: string;
  url: string;
};
