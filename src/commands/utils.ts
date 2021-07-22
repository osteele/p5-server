import chalk from 'chalk';

// print the message to standard output, and exit with status code 1
export function die(message: string) {
    console.error(chalk.red('Error:', message));
    process.exit(1);
}
