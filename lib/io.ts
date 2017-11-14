import * as fs     from 'fs';
import * as path   from 'path';

export function loadJSON(f: string): any {
  const content = fs.readFileSync(f).toString();
  try {
    return JSON.parse(content);
  } catch (e) {
    console.log(`failed to parse JSON in ${f}`);
    process.exit(1);
  }
}

export function listAllFiles(dirs: string[], r?: RegExp): string[] {
  return Array.prototype.concat.apply([], dirs.map(d => listFiles(d, r)));
}

export function listFiles(p: string, r?: RegExp): string[] {
  let res: string[] = [];

  if (!fs.statSync(p).isDirectory()) {
    return r === undefined || r.test(p) ? [p] : [];
  }

  const ps = fs.readdirSync(p).map(file => path.resolve(p, file));
  for (const p of ps) {
    res = res.concat(listFiles(p, r));
  }

  return res;
}
