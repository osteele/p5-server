import { DirectoryExistsError, Project } from '../models/project';
import { die } from './utils';

export default function create(name: string = 'sketch', options = { force: false }) {
  const project = new Project(name);
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
