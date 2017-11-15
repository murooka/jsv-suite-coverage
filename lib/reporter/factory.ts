import { Reporter } from './base';
import { CliReporter } from './cli';
import { HtmlReporter } from './html';

export type ReporterType = 'cli' | 'html';

export function createReporter(type: ReporterType): Reporter {
  switch (type) {
    case 'cli':
      return new CliReporter();
    case 'html':
      return new HtmlReporter();
    default:
      throw new Error(`unsupported type: ${type} `);
  }
}