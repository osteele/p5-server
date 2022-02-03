export class Cdn {
  static all = new Array<Cdn>();

  static create({ matcher }: { matcher: RegExp }): Cdn {
    const cdn = new Cdn(matcher);
    Cdn.all.push(cdn);
    return cdn;
  }

  static parseUrl(url: string): { packageName: string, version: string | undefined } | null {
    const cdn = this.all.find(c => c.matchesUrl(url));
    return cdn ? cdn.parseUrl(url) : null;
  }

  private constructor(private readonly matcher: RegExp) { }

  matchesUrl(path: string): boolean {
    return this.matcher.test(path);
  }

  parseUrl(url: string): { packageName: string, version: string | undefined } | null {
    const nameWithVersion = this.matcher.exec(url)?.[1];
    if (!nameWithVersion) return null;
    const [packageName, version] = nameWithVersion.split('@');
    return { packageName, version };
  }
}

Cdn.create({ matcher: /^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/ });
Cdn.create({ matcher: /^https:\/\/cdn\.skypack\.dev\/([^/@]+)/ });
Cdn.create({ matcher: /^https:\/\/unpkg\.com\/([^/@]+)/ });
