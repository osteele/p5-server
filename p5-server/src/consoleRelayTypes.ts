/** Types of the messages that the client-side console relay sends on the web
 * socket to the server. */

// TODO: merge these with the types in eventTypes.ts

export type ConsoleMethodName = 'clear' | 'debug' | 'error' | 'info' | 'log' | 'warn';

export type ConnectionMessage = {
  type: 'opened';
};

export type ConsoleMethodMessage = {
  method: ConsoleMethodName;
  args: unknown[];
  argStrings?: (string | null)[];
};

export type DocumentMessage = {
  type: 'visibilitychange';
  visibilityState: typeof document.visibilityState;
};

export type ErrorMessage = {
  type: 'error';
  message: string;
  url?: string;
  line?: number;
  col?: number;
  stack?: string;
};

export type UnhandledRejectionMessage = {
  type: 'unhandledRejection';
  message: string;
  stack: string;
};

export type WindowMessage = {
  type: 'DOMContentLoaded' | 'load' | 'pagehide';
};

export type MessageCore =
  | ConnectionMessage
  | ConsoleMethodMessage
  | DocumentMessage
  | ErrorMessage
  | UnhandledRejectionMessage
  | WindowMessage;

export type Message = MessageCore & {
  clientId: string;
  stack?: string;
  timestamp: string;
  url: string;
};
