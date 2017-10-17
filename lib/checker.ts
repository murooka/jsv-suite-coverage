import { Schema } from './validator';

class Context {
  id: string;
  paths: string[];

  constructor(id: string) {
    this.id = id;
    this.paths = [];
  }

  get ref(): string {
    return `${this.id}#${this.pointer}`;
  }

  get pointer(): string {
    return this.paths.map(p => `/${p}`).join('');
  }

  pushSubPath(subPath: string | number) {
    this.paths.push(subPath.toString());
  }

  popSubPath() {
    this.paths.pop();
  }

  withSubPath(subPath: string | number, cb: (ctx: Context) => void) {
    this.pushSubPath(subPath);
    cb(this);
    this.popSubPath();
  }
}

export function enumeratePointers(schema: Schema): string[] {
  let id = '';
  if (schema.id) {
    [ id ] = schema.id.split('#');
  }
  return enumerate(new Context(id), schema);
}

function enumerate(ctx: Context, schema: Schema): string[] {
  let rv = [] as string[];

  ctx.withSubPath('$ref', ctx => {
    if (schema.$ref) rv.push(ctx.ref);
  });

  ctx.withSubPath('allOf', ctx => {
    if (schema.allOf) {
      rv.push(ctx.ref);
      for (let i=0; i<schema.allOf.length; i++) {
        const scm = schema.allOf[i];
        ctx.withSubPath(i, ctx => {
          rv = rv.concat(enumerate(ctx, scm));
        });
      }
    }
  });

  ctx.withSubPath('anyOf', ctx => {
    if (schema.anyOf) {
      rv.push(ctx.ref);
      for (let i=0; i<schema.anyOf.length; i++) {
        const scm = schema.anyOf[i];
        ctx.withSubPath(i, ctx => {
          rv = rv.concat(enumerate(ctx, scm));
        });
      }
    }
  });

  ctx.withSubPath('oneOf', ctx => {
    if (schema.oneOf) {
      rv.push(ctx.ref);
      for (let i=0; i<schema.oneOf.length; i++) {
        const scm = schema.oneOf[i];
        ctx.withSubPath(i, ctx => {
          rv = rv.concat(enumerate(ctx, scm));
        });
      }
    }
  });

  ctx.withSubPath('not', ctx => {
    if (schema.not) {
      rv.push(ctx.ref);
      rv = rv.concat(enumerate(ctx, schema.not));
    }
  });

  ctx.withSubPath('type', ctx => {
    if (schema.type) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('enum', ctx => {
    if (schema.enum) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('properties', ctx => {
    if (schema.properties) {
      const props = schema.properties;
      for (const key of Object.keys(props)) {
        ctx.withSubPath(key, ctx => {
          rv = rv.concat(enumerate(ctx, props[key]));
        });
      }
    }
  });

  ctx.withSubPath('patternProperties', ctx => {
    if (schema.patternProperties) {
      const props = schema.patternProperties;
      for (const key of Object.keys(props)) {
        ctx.withSubPath(key, ctx => {
          rv.push(ctx.ref);
          rv = rv.concat(enumerate(ctx, props[key]));
        });
      }
    }
  });

  ctx.withSubPath('additionalProperties', ctx => {
    if (schema.additionalProperties !== undefined) {
      const props = schema.additionalProperties;
      if (typeof props === 'boolean') {
        rv.push(ctx.ref);
      } else {
        rv = rv.concat(enumerate(ctx, props));
      }
    }
  });

  ctx.withSubPath('maxProperties', ctx => {
    if (schema.maxProperties !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('minProperties', ctx => {
    if (schema.minProperties !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('required', ctx => {
    if (schema.required) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('dependencies', ctx => {
    if (schema.dependencies) {
      for (const key of Object.keys(schema.dependencies)) {
        const scm = schema.dependencies[key];
        ctx.withSubPath(key, ctx => {
          if (Array.isArray(scm)) {
            rv.push(ctx.ref);
          } else {
            rv = rv.concat(enumerate(ctx, scm));
          }
        });
      }
    }
  });

  ctx.withSubPath('items', ctx => {
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        const items = schema.items;
        const len = items.length;
        for (let i=0; i<len; i++) {
          ctx.withSubPath(i, ctx => {
            rv = rv.concat(enumerate(ctx, items[i]));
          });
        }
      } else {
        rv = rv.concat(enumerate(ctx, schema.items));
      }
    }
  });

  ctx.withSubPath('additionalItems', ctx => {
    if (schema.additionalItems !== undefined) {
      rv.push(ctx.ref);
      if (typeof schema.additionalItems === 'boolean') {
      } else {
        const scm = schema.additionalItems;
        rv = rv.concat(enumerate(ctx, scm));
      }
    }
  });

  ctx.withSubPath('uniqueItems', ctx => {
    if (schema.uniqueItems) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('maxItems', ctx => {
    if (schema.maxItems !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('minItems', ctx => {
    if (schema.minItems !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('maxLength', ctx => {
    if (schema.maxLength !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('minLength', ctx => {
    if (schema.minLength !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('pattern', ctx => {
    if (schema.pattern !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('multipleOf', ctx => {
    if (schema.multipleOf !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('maximum', ctx => {
    if (schema.maximum !== undefined) {
      rv.push(ctx.ref);
    }
  });

  ctx.withSubPath('minimum', ctx => {
    if (schema.minimum !== undefined) {
      rv.push(ctx.ref);
    }
  });

  return rv;
}
