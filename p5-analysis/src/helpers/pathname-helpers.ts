export function isHtmlPathname(pathname: string) {
  return /\.html?/i.test(pathname);
}

export function isScriptPathname(pathname: string) {
  return /\.js$/i.test(pathname);
}
