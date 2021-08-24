// eslint-disable-next-line @typescript-eslint/no-explicit-any

/** This list is not extensive. */
export type BrowserConsoleEventMethods = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'clear';

export type BrowserConsoleEvent = {
  method: BrowserConsoleEventMethods;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  argStrings: (string | null)[];
  clientId: string;
  url: string;
  file?: string;
};

export type BrowserErrorEvent = (
  | { kind: 'error'; line: number; col: number; url: string }
  | { kind: 'unhandledRejection' }
) & {
  message: string;
  stack?: string;
  clientId: string;
  url: string;
  file?: string;
};
