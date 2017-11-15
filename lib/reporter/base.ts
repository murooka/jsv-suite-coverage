import { CoverageResultSet } from '../checker';

export interface Reporter {
  report(results: CoverageResultSet): void;
}