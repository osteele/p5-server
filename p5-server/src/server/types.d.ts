// eslint-disable-next-line @typescript-eslint/no-explicit-any

export type SketchConsoleEvent = {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  url: string;
  file?: string;
};
export type SketchErrorEvent = ErrorMessageEvent & { url: string; file?: string };
export type ErrorMessageEvent = (
  | { kind: 'error'; line: number; col: number; url: string }
  | { kind: 'unhandledRejection' }
) & {
  message: string;
  stack: string;
};
