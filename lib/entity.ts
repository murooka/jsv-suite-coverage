export interface Schema {
  id?: string;
  definitions?: { [k: string]: Schema };
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
  dependencies?: { [k: string]: string[] | Schema };
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

export interface Test {
  description: string;
  data: any;
  valid: boolean;
}

export interface Suite {
  description: string;
  schema: Schema;  
  tests: Test[];
}

export interface SuiteSet {
  filename: string;
  suites: Suite[];
}