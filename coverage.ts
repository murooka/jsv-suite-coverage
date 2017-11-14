/// <reference path="./typings/node-getopt.d.ts" />

import * as getopt from 'node-getopt';

import { listAllFiles, loadJSON } from './lib/io';
import Validator from './lib/validator';
import { measureCoverage } from './lib/checker';

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

measureCoverage(schemas, suites, targets);

