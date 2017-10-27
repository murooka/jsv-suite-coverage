/// <reference path="./typings/node-getopt.d.ts" />
import * as fs     from 'fs';
import * as path   from 'path';
import * as getopt from 'node-getopt';
import * as color  from 'colors/safe';

import Validator from './lib/validator';
import { enumeratePointers } from './lib/checker';

function padStart(s: string, len: number): string {
  for (let i = s.length; i<len; i++) {
    s = ' ' + s;
  }
  return s;
}

const { options } = getopt.create([
  ['' , 'schema=ARG+', 'schema file/directory'],
  ['' , 'suite=ARG+' , 'suite file/directory'],
  ['' , 'target=ARG+', 'coverage target file/directory'],
  ['h', 'help'       , 'display help'],
]).bindHelp().parseSystem();

const schemaDirs = options['schema'] || [];
const suiteDirs = options['suite'] || [];
const targetDirs = options['target'] || schemaDirs || [];

if (suiteDirs.length === 0) {
  console.log('error: suite-dir is not specified');
  process.exit(1);
}

const schemas = listAllFiles(schemaDirs, /\.json$/).map(loadJSON);
const suites = Array.prototype.concat.apply([], listAllFiles(suiteDirs, /\.json$/).map(loadJSON));
const targets = listAllFiles(targetDirs, /\.json$/).map(loadJSON);

const checked = {} as { [k: string]: { [b: string]: boolean} };
const validator = new Validator();
validator.onValidate = (keyword: string, pointer: string, error: Error | null) => {
  checked[pointer] = checked[pointer] || {};
  checked[pointer][error ? 'false' : 'true'] = true;
};
for (const schema of schemas) {
  validator.addSchema(schema.id, schema);
}

for (const suite of suites) {
  validator.putSchema('@entry', suite.schema);
  for (const test of suite.tests) {
    const { isValid } = validator.validate('@entry', test.data);
    if (isValid != test.valid) {
      // console.log(`  [${color.red('FAIL')}] "${suite.description}" "${test.description}"`);
    }
  }
}

for (const schema of targets.sort((a,b) => a.id > b.id ? 1 : a.id < b.id ? -1 : 0)) {
  const pointers = enumeratePointers(schema);
  // if (1 > 0) { console.log(schema); console.log(pointers); continue; }
  let passed = 0;
  let failed = 0;
  const details = [] as string[];
  for (const pointer of pointers) {
    if (1 < 0) {
      for (const b of [true, false]) {
        if (checked[pointer] && checked[pointer][b.toString()]) {
          passed++;
        } else {
          failed++;
          details.push(`  - ${pointer}: ${b ? 'valid' : 'invalid'} case`);
        }
      }
    } else {
      if (checked[pointer]) {
        passed++;
      } else {
        failed++;
        details.push(`  - ${pointer}`);
      }
    }
  }
  const percent = Math.floor(100*passed/(passed+failed));
  console.log(`${padStart(`${percent}`, 3)}% [${passed}/${passed + failed}] ${schema.id}`);
  // console.log(`${schema.id}:`);
  // console.log(`  ${passed} of ${passed + failed} covered`);
  // for (const d of details) console.log(d);
}

// console.log(JSON.stringify(schemas, null, 4));
// console.log(JSON.stringify(suites, null, 4));

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

  if (!fs.statSync(p).isDirectory()) {
    return [p];
  }

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
