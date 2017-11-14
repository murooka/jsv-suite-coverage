import { table } from 'table';

import { CoverageResultSet } from '../checker';

export class CliReporter {
  report(resultSet: CoverageResultSet): void {
    const rows: string[][] = [
      ['id', 'coverage', 'total', 'either', 'both'],
    ];
    for (const id of Object.keys(resultSet)) {
      const results = resultSet[id];
      let bothPassed = 0;
      let eitherPassed = 0;
      for (const result of resultSet[id]) {
        if (result.succeeded && result.failed) bothPassed += 1;
        if (result.succeeded || result.failed) eitherPassed += 1;
      }

      const rate = (bothPassed + eitherPassed) / 2 / results.length;
      rows.push([ id, `${rate.toFixed(3)}`, `${results.length}`, `${eitherPassed}`, `${bothPassed}` ]);
    }

    const config = {
      columns: {
        1: { alignment: 'right' },
        2: { alignment: 'right' },
        3: { alignment: 'right' },
        4: { alignment: 'right' },
      },
      drawHorizontalLine: (index: number, size: number): boolean => {
        return index === 0 || index === 1 || index === size;
      },
    } as any;
    const output = table(rows, config);
    console.log(output);
  }  
}