import { Reporter } from './base';
import { CliReporter } from './cli';

export type ReporterType = 'cli';

export function createReporter(type: ReporterType): Reporter {
  switch (type) {
    case 'cli':
      return new CliReporter();
    default:
      throw new Error(`unsupported type: ${type} `);
  }
}