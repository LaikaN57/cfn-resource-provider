import { Ajv } from "ajv";

const ajv = new Ajv();

// TODO: Patch validate function to fill in default values

export function validate(obj, schema): boolean {
  const valid = ajv.validate(schema, obj);
  if (!valid) {
    console.debug(ajv.errors);
  }
  return valid;
}
