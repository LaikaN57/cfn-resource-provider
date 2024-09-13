import { Ajv } from "ajv";

const ajv = new Ajv();

// TODO: Patch validate function to fill in default values

export function validate(obj: unknown, schema: object): boolean {
  // console.debug("Validating object", JSON.stringify(obj, null, 2), "against schema", JSON.stringify(schema, null, 2));
  const valid = ajv.validate(schema, obj);
  if (!valid) {
    console.debug(ajv.errors);
  }
  return valid;
}
