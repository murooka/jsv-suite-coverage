/// <reference path="./typings/colors.d.ts" />
import * as fs from 'fs';
import * as path from 'path';
import * as color from 'colors/safe';

import Validator from './lib/validator';

const suiteFile = process.argv[2] || './example/suite/suite1.json';
let suites: any[] = [];
const json = fs.readFileSync(suiteFile).toString();
try {
  const objs: any[] = JSON.parse(json);
  suites = suites.concat(objs);
} catch (e) {
  console.log('failed to parse json: ', json);
}

const validator = new Validator();
validator.onValidate = (keyword: string, pointer: string, error: Error | null) => {
  console.log(keyword, pointer, !error);
};
const metaSchema = JSON.parse(fs.readFileSync('./example/schema/draft4.json').toString());
validator.addSchema(metaSchema.id, metaSchema);

let totalCount = 0;
let failCount = 0;
for (const suite of suites) {

  validator.putSchema('@entry', suite.schema);
  for (const test of suite.tests) {
    totalCount += 1;
    const { isValid } = validator.validate('@entry#', test.data);
    if (isValid == test.valid) {
    } else {
      failCount += 1;
      console.log(`  [${color.red('FAIL')}] "${suite.description}" "${test.description}"`);
    }
  }
}

console.log(`${failCount}/${totalCount} failed`);

function listAllFiles(dirs: string[]): string[] {
  return Array.prototype.concat.apply([], dirs.map(listFiles));
}

function listFiles(p: string): string[] {
  let res: string[] = [];

  const ps = fs.readdirSync(p).map(file => path.resolve(p, file));
  for (const p of ps) {
    if (fs.statSync(p).isDirectory()) {
      res = res.concat(listFiles(p));
    } else {
      res.push(p);
    }
  }

  return res;
}
