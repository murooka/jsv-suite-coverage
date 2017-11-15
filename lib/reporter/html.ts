import { fail } from 'assert';
import { table } from 'table';
import * as ejs from 'ejs';
import * as fs from 'fs';

import { CoverageResultSet } from '../checker';

interface Result {
  id: string;
  target: number;
  successCoverage: number;
  failureCoverage: number;
  details: Detail[];
}

interface Detail {
  pointer: string;
  success: boolean;
  failure: boolean;
}

export class HtmlReporter {
  template: ejs.TemplateFunction;

  constructor() {
    const s = fs.readFileSync('./template.html.ejs').toString();
    this.template = ejs.compile(s);
  }

  report(resultSet: CoverageResultSet): void {
    const rs: Result[] = [];
    for (const id of Object.keys(resultSet)) {
      const details: Detail[] = [];
      const results = resultSet[id];
      let successCase = 0;
      let failureCase = 0;
      for (const result of results) {
        details.push({
          pointer: result.pointer.replace(id + '#', ''),
          success: result.succeeded,
          failure: result.failed,
        });
        if (result.succeeded) successCase++;
        if (result.failed) failureCase++;
      }
      const target = results.length;
      rs.push({
        id,
        target,
        successCoverage: successCase / target,
        failureCoverage: failureCase / target,
        details,
      });
    }


    const output = this.template({ results: rs });
    console.log(output);
  }  
}
