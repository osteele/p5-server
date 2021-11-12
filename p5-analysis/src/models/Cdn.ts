export class Cdn {
  static all = new Array<Cdn>();

  static create({ matcher }: { matcher: RegExp }): Cdn {
    const cdn = new Cdn(matcher);
    Cdn.all.push(cdn);
    return cdn;
  }

  static parseUrl(url: string): { packageName: string } | null {
    const cdn = this.all.find(c => c.matches(url));
    return cdn ? cdn.parseUrl(url) : null;
  }

  private constructor(private readonly matcher: RegExp) {}

  matches(path: string): boolean {
    return this.matcher.test(path);
  }

  parseUrl(url: string): { packageName: string } | null {
    const name = this.matcher.exec(url)?.[1];
    return name ? { packageName: name } : null;
  }
}

Cdn.create({ matcher: /^https:\/\/cdn\.jsdelivr\.net\/npm\/([^/]+)/ });
Cdn.create({ matcher: /^https:\/\/cdn\.skypack\.dev\/([^/@]+)/ });
Cdn.create({ matcher: /^https:\/\/unpkg\.com\/([^/@]+)/ });
