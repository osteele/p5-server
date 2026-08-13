export class Cdn {
  static all = [] as Cdn[];

  static create({ matcher }: { matcher: RegExp }): Cdn {
    const cdn = new Cdn(matcher);
    Cdn.all.push(cdn);
    return cdn;
  }

  static parseUrl(
    url: string
  ): { packageName: string; version: string | undefined } | null {
    const cdn = Cdn.all.find((c) => c.matchesUrl(url));
    return cdn ? cdn.parseUrl(url) : null;
  }

  private constructor(private readonly matcher: RegExp) {}

  matchesUrl(path: string): boolean {
    return this.matcher.test(path);
  }

  parseUrl(
    url: string
  ): { packageName: string; version: string | undefined } | null {
    const specifier = this.matcher.exec(url)?.[1];
    return specifier ? parseNpmSpecifier(specifier) : null;
  }
}

export function parseNpmSpecifier(
  specifier: string
): { packageName: string; version: string | undefined } | null {
  const match =
    /^(?<packageName>(?:@[^/@]+\/)?[^/@]+)(?:@(?<version>[^/]+))?$/.exec(
      specifier
    );
  if (!match?.groups) return null;
  return {
    packageName: match.groups.packageName,
    version: match.groups.version,
  };
}

const npmSpecifier = '((?:@[^/]+/)?[^/]+)';
Cdn.create({
  matcher: new RegExp(`^https://cdn\\.jsdelivr\\.net/npm/${npmSpecifier}`),
});
Cdn.create({
  matcher: new RegExp(`^https://cdn\\.skypack\\.dev/${npmSpecifier}`),
});
Cdn.create({ matcher: new RegExp(`^https://unpkg\\.com/${npmSpecifier}`) });
