// eslint-disable-next-line @typescript-eslint/no-explicit-any

export type BrowserConsoleEvent = {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  argStrings: (string | null)[];
  url: string;
  file?: string;
};
export type BrowserErrorEvent = (
  | { kind: 'error'; line: number; col: number; url: string }
  | { kind: 'unhandledRejection' }
) & {
  message: string;
  stack?: string;
  url: string;
  file?: string;
};
