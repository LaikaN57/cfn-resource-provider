/**
 * This module provides a function for validating objects against JSON schemas.
 */

import { Ajv } from "ajv";

/**
 * Initializes a new instance of the Ajv class.
 */
const ajv = new Ajv();

// TODO: Patch validate function to fill in default values

/**
 * Validates an object against a given schema.
 *
 * @param obj - The object to be validated.
 * @param schema - The schema to validate against.
 * @returns A boolean indicating whether the object is valid according to the schema.
 */
export function validate(obj: unknown, schema: object): boolean {
  // console.debug("Validating object", JSON.stringify(obj, null, 2), "against schema", JSON.stringify(schema, null, 2));
  const valid = ajv.validate(schema, obj);
  if (!valid) {
    console.debug(ajv.errors);
  }
  return valid;
}
