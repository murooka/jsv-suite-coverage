/// <reference path="./typings/colors.d.ts" />
/// <reference path="./typings/node-getopt.d.ts" />
import * as fs from 'fs';
import * as path from 'path';
import * as color from 'colors/safe';
import * as getopt from 'node-getopt';

import Validator from './lib/validator';
import { enumeratePointers } from './lib/checker';

const { options } = getopt.create([
  ['' , 'schema-dir=ARG+', 'schema directory'],
  ['' , 'suite-dir=ARG+' , 'suite directory'],
  ['h', 'help'           , 'display help'],
]).bindHelp().parseSystem();

const schemaDirs = options['schema-dir'] || [];
const suiteDirs = options['suite-dir'] || [];

if (suiteDirs.length === 0) {
  console.log('error: suite-dir is not specified');
  process.exit(1);
}

const schemas = listAllFiles(schemaDirs, /\.json$/).map(loadJSON);
const suitesGroups = listAllFiles(suiteDirs, /\.json$/).map(f => ({ filename: f, suites: loadJSON(f) }));

const validator = new Validator();
for (const schema of schemas) {
  validator.addSchema(schema.id, schema);
}

let totalCount = 0;
let failCount = 0;
for (const { filename, suites } of suitesGroups) {
  for (const suite of suites) {
    validator.putSchema('@entry', suite.schema);
    for (const test of suite.tests) {
      totalCount += 1;
      const { isValid } = validator.validate('@entry#', test.data);
      if (isValid == test.valid) {
        // console.log(`  [${color.green('PASS')}] ${filename} "${suite.description}" "${test.description}"`);
      } else {
        failCount += 1;
        console.log(`  [${color.red('FAIL')}] ${filename} "${suite.description}" "${test.description}"`);
      }
    }
  }
}

console.log(`${failCount}/${totalCount} failed`);

function loadJSON(f: string): any {
  const content = fs.readFileSync(f).toString();
  try {
    return JSON.parse(content);
  } catch (e) {
    console.log(`failed to parse JSON in ${f}`);
    process.exit(1);
  }
}

function listAllFiles(dirs: string[], r?: RegExp): string[] {
  return Array.prototype.concat.apply([], dirs.map(d => listFiles(d, r)));
}

function listFiles(p: string, r?: RegExp): string[] {
  let res: string[] = [];

  const ps = fs.readdirSync(p).map(file => path.resolve(p, file));
  for (const p of ps) {
    if (fs.statSync(p).isDirectory()) {
      res = res.concat(listFiles(p, r));
    } else {
      if (r === undefined || r.test(p)) {
        res.push(p);
      }
    }
  }

  return res;
}
