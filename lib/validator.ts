/// <reference path="../typings/jsonpointer.d.ts" />
/// <reference path="../typings/deep-equal.d.ts" />
import * as JsonPointer from 'jsonpointer';
import * as equal from 'deep-equal';

import { Schema } from './entity';

class Context {
  id: string;
  paths: string[];

  constructor(id: string, pointer: string) {
    this.id = id;
    this.paths = pointer ? pointer.replace(/%25/g, '%').replace(/^\//, '').split('/') : [];
  }

  static fromRef(ref: string): Context {
    const { id, pointer } = parseRef(ref);
    return new Context(id, pointer);
  }

  get pointer(): string {
    return this.paths.map(p => `/${p}`).join('');
  }

  pushSubPath(subPath: string) {
    this.paths.push(subPath);
  }

  popSubPath() {
    this.paths.pop();
  }
}


interface Error {
  message: string;
  childErrors?: Error[],
}

function repeat(s: string, level: number): string {
  let rv = '';
  for (let i=0; i<level; i++) rv += s;
  return rv;
}

function displayErrors(errors: Error[], level: number = 0): string {
  let s = '';
  for (const e of errors) {
    s += `${repeat('  ', level)}${e.message}\n`;
    if (!e.childErrors) continue;

    s += `${repeat('  ', level)}  ${displayErrors(e.childErrors, level + 1)}\n`;
  }
  return s.replace(/\n$/, '');
}

interface Result {
  isValid: boolean;
}

function parseRef(ref: string): { id: string, pointer: string } {
  const [ id, pointer ] = ref.split('#');
  return { id, pointer };
}

type ValidateCallback = (keyword: string, pointer: string, error: Error | null) => void;

export default class Validator {
  schemaMap: { [id: string]: any };
  onValidate: ValidateCallback | null;

  constructor() {
    this.schemaMap = {};
  }

  addSchema(id: string, schema: any) {
    if (this.schemaMap[id]) throw new Error(`id ${id} already exists`);

    this.putSchema(id, schema);
  }

  putSchema(id: string, schema: any) {
    const trimmedId = id.replace(/#$/, '');
    this.schemaMap[trimmedId] = schema;
  }

  doCallback(ctx: Context, keyword: string, error: Error | null) {
    if (this.onValidate) this.onValidate(keyword, `${ctx.id}#${ctx.pointer}`, error);
  }

  validate(ref: string, data: any): Result {
    const ctx = Context.fromRef(ref);
    const schema = JsonPointer.get(this.schemaMap[ctx.id], ctx.pointer) as Schema;
    const errors = this.validateRoot(ctx, schema, data);

    return { isValid: errors.length === 0 };
  }

  validateRoot(ctx: Context, schema: Schema, data: any): Error[] {
    let errors = [] as Error[];

    if (schema.$ref) {
      ctx.pushSubPath('$ref');

      const { id, pointer } = parseRef(schema.$ref);
      const newCtx = id ? new Context(id, pointer) : new Context(ctx.id, pointer);
      const newSchema = JsonPointer.get(this.schemaMap[newCtx.id], newCtx.pointer) as Schema;
      const errs = this.validateRoot(newCtx, newSchema, data);

      this.doCallback(ctx, '$ref', { message: `$ref failed`, childErrors: errs });

      ctx.popSubPath();

      return errs;
    }

    if (schema.allOf) {
      const childErrors = [] as Error[];
      ctx.pushSubPath('allOf');
      for (let i=0; i<schema.allOf.length; i++) {
        ctx.pushSubPath(i.toString());
        const subSchema = schema.allOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        if (errs.length > 0) childErrors.push({ message: `one of allOf schema failed`, childErrors: errs });
        ctx.popSubPath();
      }

      const error = childErrors.length > 0 ? { message: `allOf failed:`, childErrors } : null;
      if (error) errors.push(error);
      this.doCallback(ctx, 'allOf', error);

      ctx.popSubPath();
    }

    if (schema.anyOf) {
      ctx.pushSubPath('anyOf');

      let passed = false;
      for (let i=0; i<schema.anyOf.length; i++) {
        ctx.pushSubPath(i.toString());
        const subSchema = schema.anyOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        ctx.popSubPath();
        if (errs.length === 0) {
          passed = true;
          break;
        }
      }

      const error = passed ? null : { message: `anyOf failed` };
      if (error) errors.push(error);
      this.doCallback(ctx, 'anyOf', error);

      ctx.popSubPath();
    }

    if (schema.oneOf) {
      let count = 0;
      ctx.pushSubPath('oneOf');
      for (let i=0; i<schema.oneOf.length; i++) {
        ctx.pushSubPath(i.toString());
        const subSchema = schema.oneOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        ctx.popSubPath();
        if (errs.length === 0) count++;
      }

      const error = count !== 1 ? { message: `oneOf failed, ${count} passed` } : null;
      if (error) errors.push(error);
      this.doCallback(ctx, 'oneOf', error);

      ctx.popSubPath();
    }

    if (schema.not) {
      ctx.pushSubPath('not');

      const errs = this.validateRoot(ctx, schema.not, data);
      const error = errs.length === 0 ? { message: `not failed` } : null;
      if (error) errors.push(error);
      this.doCallback(ctx, 'not', error);

      ctx.popSubPath();
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const errs = this.validateObject(ctx, schema, data);
      errors = errors.concat(errs);
    }

    if (Array.isArray(data)) {
      const errs = this.validateArray(ctx, schema, data);
      errors = errors.concat(errs);
    }

    if (typeof data === 'string') {
      const errs = this.validateString(ctx, schema, data);
      errors = errors.concat(errs);
    }

    if (typeof data === 'number') {
      const errs = this.validateNumber(ctx, schema, data);
      errors = errors.concat(errs);
    }

    if (schema.type) {
      ctx.pushSubPath('type');

      const type: string | string[] = schema.type;
      const types = Array.isArray(type) ? type : [type];
      const error = this.validateType(ctx, types, data);
      if (error) errors.push(error);
      this.doCallback(ctx, 'type', error);

      ctx.popSubPath();
    }

    if (schema.enum) {
      ctx.pushSubPath('enum');

      const enums: any[] = schema.enum;
      const error = this.validateEnum(ctx, enums, data);

      if (error) errors.push(error);
      this.doCallback(ctx, 'enum', error);

      ctx.popSubPath();
    }

    return errors;
  }

  validateObject(ctx: Context, schema: Schema, data: { [k: string]: any }): Error[] {
    const errors = [] as Error[];

    const checked = {} as { [k: string]: boolean };

    if (schema.properties) {
      ctx.pushSubPath('properties');
      for (const key of Object.keys(schema.properties)) {
        if (data[key] === undefined) continue;

        checked[key] = true;

        ctx.pushSubPath(key);
        const errs = this.validateRoot(ctx, schema.properties[key], data[key]);
        const error = errs.length > 0 ? { message: `properties "${key}" failed`, childErrors: errs } : null;
        if (error) errors.push(error);

        ctx.popSubPath();
      }
      ctx.popSubPath();
    }

    if (schema.patternProperties) {
      ctx.pushSubPath('patternProperties');
      for (const pattern of Object.keys(schema.patternProperties)) {
        ctx.pushSubPath(pattern);
        for (const key of Object.keys(data)) {
          if (!new RegExp(pattern).test(key)) continue;

          checked[key] = true;
          const subSchema = schema.patternProperties[pattern];
          const errs = this.validateRoot(ctx, subSchema, data[key]);
          const error = errs.length > 0 ? { message: `patternProperties "${pattern}" failed`, childErrors: errs } : null;
          if (error) errors.push(error);
          this.doCallback(ctx, 'patternProperties', error);
        }
        ctx.popSubPath();
      }
      ctx.popSubPath();
    }

    if (typeof schema.additionalProperties === 'boolean' && !schema.additionalProperties) {
      ctx.pushSubPath('additionalProperties');

      let error = null as Error | null;
      if (Object.keys(checked).length < Object.keys(data).length) error = { message: `additionalProperties failed` };
      if (error) errors.push(error);
      this.doCallback(ctx, 'additionalProperties', error);

      ctx.popSubPath();
    }

    if (typeof schema.additionalProperties === 'object' && schema.additionalProperties) {
      ctx.pushSubPath('additionalProperties');

      for (const key of Object.keys(data)) {
        if (checked[key]) continue;

        const errs = this.validateRoot(ctx, schema.additionalProperties, data[key]);
        const error = errs.length > 0 ? { message: `additionalProperties failed`, childErrors: errs } : null;
        if (error) errors.push(error);
      }

      ctx.popSubPath();
    }

    if (schema.maxProperties !== undefined) {
      ctx.pushSubPath('maxProperties');

      let error = null as Error | null;
      if (Object.keys(data).length > schema.maxProperties) error = { message: `maxProperties "${schema.maxProperties}" failed` };
      if (error) errors.push(error);
      this.doCallback(ctx, 'maxProperties', error);

      ctx.popSubPath();
    }

    if (schema.minProperties !== undefined) {
      ctx.pushSubPath('minProperties');

      let error = null as Error | null;
      if (Object.keys(data).length < schema.minProperties) error = { message: `minProperties "${schema.minProperties}" failed` };
      if (error) errors.push(error);
      this.doCallback(ctx, 'minProperties', error);

      ctx.popSubPath();
    }

    if (schema.required) {
      ctx.pushSubPath('required');

      const errs = [] as Error[];
      for (let i=0; i<schema.required.length; i++) {
        ctx.pushSubPath(i.toString());

        const key = schema.required[i];
        const error =  data[key] === undefined ? { message: `required "${key}" failed` } : null;
        if (error) errs.push(error);

        ctx.popSubPath();
      }

      const error = errs.length > 0 ? { message: `required failed`, childErrors: errs } : null;
      if (error) errors.push(error);
      this.doCallback(ctx, 'required', error);

      ctx.popSubPath();
    }

    if (schema.dependencies !== undefined) {
      ctx.pushSubPath('dependencies');
      for (const key of Object.keys(schema.dependencies)) {
        if (data[key] === undefined) continue;

        ctx.pushSubPath(key);

        const subSchema = schema.dependencies[key];
        if (Array.isArray(subSchema)) {
          const props = subSchema;
          const errs = [] as Error[];
          for (let i=0; i<props.length; i++) {
            ctx.pushSubPath(i.toString());

            const k = props[i];
            const error = data[k] === undefined ? { message: `dependencies "${key}" failed` } : null;
            if (error) errs.push(error);

            ctx.popSubPath();
          }

          const error = errs.length > 0 ? { message: `dependencies failed`, childErrors: errs } : null;
          if (error) errors.push(error);
          this.doCallback(ctx, 'dependencies', error);
        } else {
          const errs = this.validateRoot(ctx, subSchema, data);
          const error = errs.length > 0 ? { message: `dependencies "${key}" failed`, childErrors: errs } : null;
          if (error) errors.push(error);
        }

        ctx.popSubPath();
      }
      ctx.popSubPath();
    }

    return errors;
  }

  validateArray(ctx: Context, schema: Schema, data: any[]): Error[] {
    const errors = [] as Error[];

    if (schema.items !== undefined) {
      if (Array.isArray(schema.items)) {
        const len = Math.min(Object.keys(data).length, schema.items.length);
        let i = 0;
        ctx.pushSubPath('items');
        for (; i < len; i++) {
          ctx.pushSubPath(i.toString());

          const errs = this.validateRoot(ctx, schema.items[i], data[i]);
          let error = errs.length > 0 ? { message: `items failed`, childErrors: errs } : null;

          if (error) errors.push(error);

          ctx.popSubPath();
        }
        ctx.popSubPath();

        if (typeof schema.additionalItems === 'boolean' && !schema.additionalItems) {
          ctx.pushSubPath('additionalItems');

          let error = null as Error | null;
          if (i < Object.keys(data).length) error = { message: `additionalItems failed` };

          if (error) errors.push(error);
          this.doCallback(ctx, 'additionalItems', error);

          ctx.popSubPath();
        }

        if (typeof schema.additionalItems === 'object' && schema.additionalItems) {
          ctx.pushSubPath('additionalItems');
          let errs = [] as Error[];
          for (; i < Object.keys(data).length; i++) {
            errs = errs.concat(this.validateRoot(ctx, schema.additionalItems, data[i]));
          }

          let error = errs.length > 0 ? { message: `additionalItems failed`, childErrors: errs } : null;
          if (error) errors.push(error);
          this.doCallback(ctx, 'additionalItems', error);

          ctx.popSubPath();
        }
      } else {
        ctx.pushSubPath('items');

        let errs = [] as Error[];
        for (const val of data) {
          errs = errs.concat(this.validateRoot(ctx, schema.items, val));
        }

        let error =  errs.length > 0 ? { message: `items failed` } : null;
        if (error) errors.push(error);

        ctx.popSubPath();
      }
    }

    if (schema.uniqueItems) {
      ctx.pushSubPath('uniqueItems');

      let error = null as Error | null;
      if (!isUnique(data)) error = { message: `uniqueItems failed` };

      if (error) errors.push(error);
      this.doCallback(ctx, 'uniqueItems', error);

      ctx.popSubPath();
    }

    if (schema.maxItems !== undefined) {
      ctx.pushSubPath('maxItems');

      let error = null as Error | null;
      if (data.length > schema.maxItems) error = { message: `maxItems "${schema.maxItems}" failed` };

      if (error) errors.push(error);
      this.doCallback(ctx, 'maxItems', error);

      ctx.popSubPath();
    }

    if (schema.minItems !== undefined) {
      ctx.pushSubPath('minItems');

      let error = null as Error | null;
      if (data.length < schema.minItems) error = { message: `minItems "${schema.minItems}" failed` };

      if (error) errors.push(error);
      this.doCallback(ctx, 'minItems', error);

      ctx.popSubPath();
    }

    return errors;
  }

  validateString(ctx: Context, schema: Schema, data: string): Error[] {
    const errors = [] as Error[];

    if (schema.maxLength !== undefined) {
      ctx.pushSubPath('maxLength');

      let error = null as Error | null;
      if (stringLength(data) > schema.maxLength) error = { message: `maxLength "${schema.maxLength}" failed` };

      if (error) errors.push(error);
      this.doCallback(ctx, 'maxLength', error);

      ctx.popSubPath();
    }

    if (schema.minLength !== undefined) {
      ctx.pushSubPath('minLength');

      let error = null as Error | null;
      if (stringLength(data) < schema.minLength) errors.push({ message: `minLength "${schema.minLength}" failed` });

      if (error) errors.push(error);
      this.doCallback(ctx, 'minLength', error);

      ctx.popSubPath();
    }

    if (schema.pattern !== undefined) {
      ctx.pushSubPath('pattern');

      let error = null as Error | null;
      if (!new RegExp(schema.pattern).test(data)) errors.push({ message: `pattern "${schema.pattern}" failed` });

      if (error) errors.push(error);
      this.doCallback(ctx, 'pattern', error);

      ctx.popSubPath();
    }

    return errors;
  }

  validateNumber(ctx: Context, schema: Schema, data: number): Error[] {
    const errors = [] as Error[];
    if (schema.maximum !== undefined) {
      ctx.pushSubPath('maximum');

      let error = null as Error | null;
      if (schema.exclusiveMaximum) {
        if (data >= schema.maximum) error = { message: `exclusive maximum "${schema.maximum}" failed` };
      } else {
        if (data > schema.maximum) error = { message: `maximum "${schema.maximum}" failed` };
      }

      if (error) errors.push(error);
      this.doCallback(ctx, 'maximum', error);

      ctx.popSubPath();
    }

    if (schema.minimum !== undefined) {
      ctx.pushSubPath('minimum');

      let error = null as Error | null;
      if (schema.exclusiveMinimum) {
        if (data <= schema.minimum) error = { message: `exclusive minimum "${schema.minimum}" failed` };
      } else {
        if (data < schema.minimum) error = { message: `minimum "${schema.minimum}" failed` };
      }

      if (error) errors.push(error);
      this.doCallback(ctx, 'minimum', error);

      ctx.popSubPath();
    }

    if (schema.multipleOf !== undefined) {
      ctx.pushSubPath('multipleOf');

      let error = null as Error | null;
      const quotient = data / schema.multipleOf;
      if (quotient !== parseInt(quotient.toString())) error = { message: `multipleOf "${schema.multipleOf}" failed` };

      if (error) errors.push(error);
      this.doCallback(ctx, 'multipleOf', error);

      ctx.popSubPath();
    }

    return errors;
  }

  validateType(ctx: Context, types: string[], data: any): Error | null {
    const t = detectType(data);
    for (const type of types) {
      if (type === t) return null;
      if (type === 'number' && t === 'integer') return null;
    }
    return { message: `type ${types.join(',')} failed` };
  }

  validateEnum(ctx: Context, enums: any[], data: any): Error | null {
    for (const e of enums) {
      if (equal(e, data, { strict: true })) return null;
    }
    return { message: `enum ${enums.join(',')} failed` };
  }
}

function isInteger(v: number): boolean {
  return v === Math.floor(v);
}

function detectType(data: any): string {
  if (data === null) return 'null';
  if (typeof data === 'boolean') return 'boolean';
  if (typeof data === 'number' && isInteger(data)) return 'integer';
  if (typeof data === 'number') return 'number';
  if (typeof data === 'string') return 'string';
  if (Array.isArray(data)) return 'array';
  return 'object';
}

function stringLength(s: string): number {
  return stringToArray(s).length;
}

function stringToArray(str: string): string[] {
    return str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
}

function isUnique(items: any[]): boolean {
  const len = items.length;

  for (let i = 0; i < len - 1; i++) {
    for (let j = i + 1; j < len; j++) {
      if (equal(items[i], items[j], { strict: true })) return false;
    }
  }

  return true;
}
