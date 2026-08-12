import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { capitalize } from '../helpers/index.js';
import { Library } from './Library.js';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export class Category {
  static all: Category[] = [];

  public readonly name: string;
  public readonly key: string;
  public readonly description: string;
  public readonly details?: string;

  private constructor(options: CategoryProperties) {
    this.name = options.name || capitalize(options.key);
    this.key = options.key;
    this.description = options.description;
    this.details = options.details;
  }

  static fromProperties(props: CategoryProperties): Category {
    const cat = new Category(props);
    Category.all.push(cat);
    return cat;
  }

  static load(): void {
    (
      JSON.parse(
        fs.readFileSync(`${dirname}/libraries/categories.json`, 'utf-8')
      ) as CategoryProperties[]
    )
      .map(Category.fromProperties)
      .forEach((cat) => {
        cat.addFromJsonFile(`${dirname}/libraries/${cat.key}-libraries.json`);
      });
  }

  addFromJsonFile(jsonPath: string): readonly Library[] {
    return Library.addFromJsonFile(jsonPath, { categoryKey: this.key });
  }

  public static findByKey(key: string): Category | undefined {
    return Category.all.find((cat) => cat.key === key);
  }

  get libraries(): Library[] {
    return Library.all.filter((lib) => lib.categoryKey === this.key);
  }
}

type CategoryProperties = {
  key: string;
  name?: string;
  description: string;
  details?: string;
};
