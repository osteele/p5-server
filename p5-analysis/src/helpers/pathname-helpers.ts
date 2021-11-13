export function isHtmlPathname(pathname: string): boolean {
  return /\.html?/i.test(pathname);
}

export function isScriptPathname(pathname: string): boolean {
  return /\.js$/i.test(pathname);
}
