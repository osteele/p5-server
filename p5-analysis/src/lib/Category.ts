import fs from 'fs';
import { capitalize } from '../utils';
import { Library } from './Library';

export class Category {
  public readonly name: string;
  public readonly key: string;
  public readonly description: string;
  public readonly details?: string;

  private constructor(options: CategoryProperties) {
    this.name = capitalize(options.key);
    this.key = options.key;
    this.description = options.description;
    this.details = options.details;
  }

  static fromProperties(props: CategoryProperties): Category {
    const cat = new Category(props);
    Library.categories.push(cat);
    return cat;
  }

  static initialize() {
    (
      JSON.parse(
        fs.readFileSync(`${__dirname}/libraries/categories.json`, 'utf-8')
      ) as CategoryProperties[]
    )
      .map(Category.fromProperties)
      .forEach(cat => {
        cat.addFromJsonFile(`${__dirname}/libraries/${cat.key}-libraries.json`);
      });
  }

  addFromJsonFile(jsonPath: string) {
    return Library.addFromJsonFile(jsonPath, { categoryKey: this.key });
  }

  public static findByKey(key: string): Category | undefined {
    return Library.categories.find(cat => cat.key === key);
  }

  get libraries(): Library[] {
    return Library.all.filter(lib => lib.categoryKey === this.key);
  }
}

type CategoryProperties = {
  key: string;
  description: string;
  details?: string;
};

Category.initialize();
