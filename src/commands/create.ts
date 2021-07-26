import { DirectoryExistsError, Project } from '../models/Project';
import { die } from '../utils';

export default function create(name: string = 'sketch', options: { force: boolean, title: string }) {
  const project = new Project(name, 'index.html', 'sketch.js', options);
  try {
    project.generate(options.force);
  } catch (err) {
    if (err instanceof DirectoryExistsError) {
      die(err.message);
    } else {
      throw err;
    }
  }
}
