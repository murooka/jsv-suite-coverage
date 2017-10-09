/// <reference path="../typings/jsonpointer.d.ts" />
/// <reference path="../typings/deep-equal.d.ts" />
import * as JsonPointer from 'jsonpointer';
import * as equal from 'deep-equal';

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
}

interface Schema {
  $ref?: string;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  not?: Schema;
  type?: string | string[];
  enum?: string[];
  properties?: { [k: string]: Schema };
  patternProperties?: { [k: string]: Schema };
  additionalProperties?: boolean | Schema;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  dependencies: { [k: string]: string[] | Schema };
  items?: Schema | Schema[];
  additionalItems?: boolean | Schema;
  uniqueItems?: boolean;
  maxItems?: number;
  minItems?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
}

interface Error {
  message: string;
  childErrors?: Error[][],
}

function displayErrors(errors: Error[]): string {
  let s = '';
  for (const e of errors) {
    s += `error: ${e.message}\n`;
    if (!e.childErrors) continue;

    for (const ces of e.childErrors) for (const ce of ces) {
      s += `- ${ce.message}\n`;
    }
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

export default class Validator {
  schemaMap: { [id: string]: any };

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

  validate(ref: string, data: any): Result {
    const ctx = Context.fromRef(ref);
    const schema = JsonPointer.get(this.schemaMap[ctx.id], ctx.pointer) as Schema;
    const errors = this.validateRoot(ctx, schema, data);
    // if (errors.length > 0) console.log(displayErrors(errors));

    return { isValid: errors.length === 0 };
  }

  validateRoot(ctx: Context, schema: Schema, data: any): Error[] {
    let errors = [] as Error[];

    if (schema.$ref) {
      const { id, pointer } = parseRef(schema.$ref);
      const newCtx = id ? new Context(id, pointer) : new Context(ctx.id, pointer);
      const newSchema = JsonPointer.get(this.schemaMap[newCtx.id], newCtx.pointer) as Schema;
      return this.validateRoot(newCtx, newSchema, data);
    }

    if (schema.allOf) {
      const childErrors = [] as Error[][];
      for (let i=0; i<schema.allOf.length; i++) {
        const subSchema = schema.allOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        if (errs.length > 0) childErrors.push(errs);
      }
      if (childErrors.length > 0) errors.push({ message: `allOf failed:`, childErrors });
    }

    if (schema.anyOf) {
      let passed = false;
      for (let i=0; i<schema.anyOf.length; i++) {
        const subSchema = schema.anyOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        if (errs.length === 0) {
          passed = true;
          break;
        }
      }
      if (!passed) errors.push({ message: `anyOf failed` });
    }

    if (schema.oneOf) {
      let count = 0;
      for (let i=0; i<schema.oneOf.length; i++) {
        const subSchema = schema.oneOf[i];
        const errs = this.validateRoot(ctx, subSchema, data);
        if (errs.length === 0) count++;
      }
      if (count !== 1) errors.push({ message: `oneOf failed, ${count} passed` });
    }

    if (schema.not) {
      const errs = this.validateRoot(ctx, schema.not, data);
      if (errs.length === 0) errors.push({ message: `not failed` });
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
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
      const type: string | string[] = schema.type;
      const types = Array.isArray(type) ? type : [type];
      const error = this.validateType(ctx, types, data);
      if (error) errors.push(error);
    }

    if (schema.enum) {
      const enums: any[] = schema.enum;
      const error = this.validateEnum(ctx, enums, data);
      if (error) errors.push(error);
    }

    return errors;
  }

  validateObject(ctx: Context, schema: Schema, data: { [k: string]: any }): Error[] {
    const errors = [] as Error[];

    const checked = {} as { [k: string]: boolean };

    if (schema.properties) {
      for (const key of Object.keys(schema.properties)) {
        if (data[key] === undefined) continue;

        checked[key] = true;
        const errs = this.validateRoot(ctx, schema.properties[key], data[key]);
        if (errs.length > 0) errors.push({ message: `properties "${key}" failed` });
      }
    }

    if (schema.patternProperties) {
      for (const pattern of Object.keys(schema.patternProperties)) {
        for (const key of Object.keys(data)) {
          if (!new RegExp(pattern).test(key)) continue;

          checked[key] = true;
          const subSchema = schema.patternProperties[pattern];
          const errs = this.validateRoot(ctx, subSchema, data[key]);
          if (errs.length > 0) errors.push({ message: `patternProperties "${pattern}" failed` });
        }
      }
    }

    if (typeof schema.additionalProperties === 'boolean' && !schema.additionalProperties) {
      if (Object.keys(checked).length < Object.keys(data).length) errors.push({ message: `additionalProperties failed` });
    }

    if (typeof schema.additionalProperties === 'object' && schema.additionalProperties) {
      for (const key of Object.keys(data)) {
        if (checked[key]) continue;

        const errs = this.validateRoot(ctx, schema.additionalProperties, data[key]);
        if (errs.length > 0) errors.push({ message: `additionalProperties failed` });
      }
    }

    if (schema.maxProperties !== undefined) {
      if (Object.keys(data).length > schema.maxProperties) errors.push({ message: `maxProperties "${schema.maxProperties}" failed` });
    }

    if (schema.minProperties !== undefined) {
      if (Object.keys(data).length < schema.minProperties) errors.push({ message: `minProperties "${schema.minProperties}" failed` });
    }

    if (schema.required) {
      for (const key of schema.required) {
        if (data[key] === undefined) errors.push({ message: `required "${key}" failed` });
      }
    }

    if (schema.dependencies !== undefined) {
      for (const key of Object.keys(schema.dependencies)) {
        if (data[key] === undefined) continue;

        const subSchema = schema.dependencies[key];
        if (Array.isArray(subSchema)) {
          for (let i=0; i<subSchema.length; i++) {
            const k = subSchema[i];
            if (data[k] === undefined) errors.push({ message: `dependencies "${key}" failed` });
          }
        } else {
          const errs = this.validateRoot(ctx, subSchema, data);
          if (errs.length > 0) errors.push({ message: `dependencies "${key}" failed` });
        }
      }
    }

    return errors;
  }

  validateArray(ctx: Context, schema: Schema, data: any[]): Error[] {
    const errors = [] as Error[];

    if (schema.items !== undefined) {
      if (Array.isArray(schema.items)) {
        const len = Math.min(Object.keys(data).length, schema.items.length);
        let i = 0;
        for (; i < len; i++) {
          const errs = this.validateRoot(ctx, schema.items[i], data[i]);
          if (errs.length > 0) errors.push({ message: `items failed` });
        }

        if (typeof schema.additionalItems === 'boolean' && !schema.additionalItems) {
          if (i < Object.keys(data).length) errors.push({ message: `additionalItems failed` });
        }

        if (typeof schema.additionalItems === 'object' && schema.additionalItems) {
          for (; i < Object.keys(data).length; i++) {
            const errs = this.validateRoot(ctx, schema.additionalItems, data[i])
            if (errs.length > 0) errors.push({ message: `additionalItems failed` });
          }
        }
      } else {
        for (const val of data) {
          const errs = this.validateRoot(ctx, schema.items, val)
          if (errs.length > 0) errors.push({ message: `items failed` });
        }
      }
    }

    if (schema.uniqueItems) {
      const len = data.length;
      let failed = false;
      LOOP:
      for (let i = 0; i < len - 1; i++) {
        for (let j = i + 1; j < len; j++) {
          if (equal(data[i], data[j], { strict: true })) {
            failed = true;
            break LOOP;
          }
        }
      }
      if (failed) errors.push({ message: `uniqueItems failed` });
    }

    if (schema.maxItems !== undefined) {
      if (data.length > schema.maxItems) errors.push({ message: `maxItems "${schema.maxItems}" failed` });
    }

    if (schema.minItems !== undefined) {
      if (data.length < schema.minItems) errors.push({ message: `minItems "${schema.minItems}" failed` });
    }

    return errors;
  }

  validateString(ctx: Context, schema: Schema, data: string): Error[] {
    const errors = [] as Error[];

    if (schema.maxLength !== undefined) {
      if (stringLength(data) > schema.maxLength) errors.push({ message: `maxLength "${schema.maxLength}" failed` });
    }

    if (schema.minLength !== undefined) {
      if (stringLength(data) < schema.minLength) errors.push({ message: `minLength "${schema.minLength}" failed` });
    }

    if (schema.pattern !== undefined) {
      if (!new RegExp(schema.pattern).test(data)) errors.push({ message: `pattern "${schema.pattern}" failed` });
    }

    return errors;
  }

  validateNumber(ctx: Context, schema: Schema, data: number): Error[] {
    const errors = [] as Error[];
    if (schema.maximum !== undefined) {
      if (schema.exclusiveMaximum) {
        if (data >= schema.maximum) errors.push({ message: `exclusive maximum "${schema.maximum}" failed` });
      } else {
        if (data > schema.maximum) errors.push({ message: `maximum "${schema.maximum}" failed` });
      }
    }

    if (schema.minimum !== undefined) {
      if (schema.exclusiveMinimum) {
        if (data <= schema.minimum) errors.push({ message: `exclusive minimum "${schema.minimum}" failed` });
      } else {
        if (data < schema.minimum) errors.push({ message: `minimum "${schema.minimum}" failed` });
      }
    }

    if (schema.multipleOf !== undefined) {
      const quotient = data / schema.multipleOf;
      if (quotient !== parseInt(quotient.toString())) errors.push({ message: `multipleOf "${schema.multipleOf}" failed` });
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

function stringToArray (str: string): string[] {
    return str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
}
