import { Category } from '../src/lib/Category';
import { Library } from '../src/lib/Library';

test('Categories.length', () => {
  expect(Library.categories.length).toBeGreaterThan(1);
});

test('Categories includes sound library', () => {
  const cat = Category.findByKey('core');
  expect(cat).toBeInstanceOf(Category);
  expect(cat!.libraries).toHaveLength(1);
  const lib = cat!.libraries[0]!;
  expect(lib.name).toBe('p5.sound');
});
