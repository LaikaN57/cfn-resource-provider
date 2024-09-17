/**
 *
 */

import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResourcePropertiesCommon,
  CloudFormationCustomResourceResponse,
  Context,
} from "aws-lambda";
import { SUCCESS, FAILED, ResponseStatus, send } from "cfn-response";
import { validate } from "./utils/default-injecting-validator";

/**
 * Interface for a CloudFormation custom resource provider.
 */
export interface IResourceProvider {
  /**
   * The CloudFormation request.
   */
  resourcePropertiesSchema: object;

  /**
   * The create method.
   */
  create(): void;

  /**
   * The update method.
   */
  update(): void;

  /**
   * The delete method.
   */
  delete(): void;
}

/**
 * Enum for the CloudFormation request type.
 */
export enum RequestType {
  Create = "Create",
  Update = "Update",
  Delete = "Delete",
}

/**
 * Type for the CloudFormation request type.
 */
export type RequestTypeType = keyof typeof RequestType;

/**
 * Represents a CloudFormation custom resource provider.
 */
export class ResourceProvider implements IResourceProvider {
  /**
   * A JSON Schema which defines a proper CloudFormation response message
   */
  static readonly cfnResponseSchema = {
    type: "object",
    required: ["Status", "Reason", "RequestId", "StackId", "LogicalResourceId"],
    properties: {
      Status: { type: "string", enum: ["SUCCESS", "FAILED"] },
      StackId: { type: "string" },
      RequestId: { type: "string" },
      LogicalResourceId: { type: "string" },
      PhysicalResourceId: { type: "string" },
      Data: { type: "object" },
    },
  };

  /**
   * The CloudFormation request.
   */
  request?: CloudFormationCustomResourceEvent;

  /**
   * The Lambda context.
   */
  context?: Context;

  /**
   * A boolean indicating whether the request is asynchronous.
   */
  asynchronous: boolean = false;

  /**
   * The CloudFormation response.
   */
  response?: CloudFormationCustomResourceResponse;

  /**
   * default json schema for request['ResourceProperties']. Override in your subclass.
   */
  resourcePropertiesSchema: object = { type: "object" };

  /**
   * The CloudFormation custom resource name.
   */
  get customCfnResourceName(): string {
    return "Custom::" + this.constructor.name.replace("Provider", "");
  }

  /**
   * Returns true if the resource type is supported by the provider.
   */
  isSupportedResourceType(): boolean {
    return this.resourceType == this.customCfnResourceName;
  }

  /**
   * sets the lambda request to process.
   *
   * @param request the CloudFormation request
   * @param context the lambda context
   */
  setRequest(request: CloudFormationCustomResourceEvent, context: Context) {
    this.request = request;
    this.context = context;
    this.asynchronous = false;
    // Setup defualt response
    this.response = {
      Status: SUCCESS,
      StackId: request.StackId,
      RequestId: request.RequestId,
      LogicalResourceId: request.LogicalResourceId,
      PhysicalResourceId:
        "PhysicalResourceId" in request ? request.PhysicalResourceId : "",
      // data, reason, noEcho
    };
  }

  /**
   * returns the custom resource property `name` if it exists, otherwise `default`
   * @param name
   * @param defaultValue
   */
  get(name: string, defaultValue: string) {
    if (name in this.properties) {
      return this.properties[name];
    }
    return defaultValue;
  }

  /**
   * returns the old resource property `name` if it exists, otherwise `default`
   * @param name
   * @param defaultValue
   */
  getOld(name: string, defaultValue: string) {
    if (this.oldProperties === undefined) {
      return defaultValue;
    }
    if (name in this.oldProperties) {
      return this.oldProperties![name];
    }
    return defaultValue;
  }

  /**
   * returns the custom resource properties from the request.
   */
  get properties() {
    return this.request!.ResourceProperties;
  }

  /**
   * returns the old custom resource properties from the request, if available.
   */
  get oldProperties():
    | CloudFormationCustomResourceResourcePropertiesCommon
    | undefined {
    if ("OldResourceProperties" in this.request!) {
      return this.request!.OldResourceProperties;
    }
    return undefined;
  }

  /**
   * returns the LogicaLResourceId from the request.
   */
  get logicalResourceId(): string {
    return this.request!.LogicalResourceId;
  }

  /**
   * returns the StackId from the request.
   */
  get stackId(): string {
    return this.request!.StackId;
  }

  /**
   * returns the RequestId from the request.
   */
  get requestId(): string {
    return this.request!.RequestId;
  }

  /**
   * returns the ResponseURL from the request.
   */
  get responseUrl(): string {
    return this.request!.ResponseURL;
  }

  /**
   * returns the PhysicalResourceId from the response. Initialized from request.
   */
  get physicalResourceId(): string {
    return this.response!.PhysicalResourceId;
  }

  set physicalResourceId(newResourceId: string) {
    this.response!.PhysicalResourceId = newResourceId;
  }

  /**
   * returns the CloudFormation request type.
   */
  get requestType(): RequestTypeType {
    return RequestType[this.request!.RequestType as RequestTypeType];
  }

  /**
   * returns the CloudFormation reason for the status.
   */
  get reason(): string | undefined {
    return this.response!.Reason;
  }

  set reason(value: string) {
    this.response!.Reason = value;
  }

  /**
   * returns the response status, 'FAILED' or 'SUCCESS'
   */
  get status(): ResponseStatus {
    return this.response!.Status;
  }

  set status(value: ResponseStatus) {
    this.response!.Status = value;
  }

  /**
   * returns the CloudFormation resource type on which to perform the request.
   */
  get resourceType(): string {
    return this.request!.ResourceType;
  }

  /**
   * returns the current value of NoEcho, or None if not set.
   */
  get noEcho(): boolean | undefined {
    return this.response!.NoEcho;
  }

  /**
   * sets the NoEcho in the response to `value`.
   */
  set noEcho(value: boolean) {
    this.response!.NoEcho = value;
  }

  /**
   * returns true when self.response is a valid CloudFormation custom resource response, otherwise false.
   * if false, it logs the reason.
   */
  isValidCfnResponse(): boolean {
    const valid = validate(this.response, ResourceProvider.cfnResponseSchema);
    if (!valid) {
      // TODO: improve error message with why it failed validation, requires upstream changes
      console.warn("invalid CloudFormation response created: " + this.response);
    }
    return valid;
  }

  /**
   * allows you to coerce the values in properties to be the type expected. Stupid CFN sends all values as Strings..
   * it is called before the json schema validation takes place.
   *
   * one day we will make it a generic method, not now...
   */
  convertPropertyTypes() {}

  /**
   * heuristic type conversion of string values in `properties`.
   * @param properties
   */
  heuristicConvertPropertyTypes(properties: any): any {
    if (properties instanceof String) {
      const v = String(properties);
      if (v == "true") {
        return true;
      } else if (v == "false") {
        return false;
      }
      const n = Number(v);
      if (!isNaN(n)) {
        return n;
      }
    } else if (properties instanceof Array) {
      // TOOD: check if this is safe to do
      for (let i = 0; i < properties.length; i++) {
        properties[i] = this.heuristicConvertPropertyTypes(properties[i]);
      }
    } else if (properties instanceof Object) {
      for (let key in properties) {
        properties[key] = this.heuristicConvertPropertyTypes(properties[key]);
      }
    }
    return properties;
  }

  /**
   * returns true if `self.properties` is a valid request as specified by the JSON schema self.resourcePropertiesSchema, otherwise False.
   * Optional properties with a default value in the schema will be added to self.porperties.
   * If false, self.reason and self.status are set.
   */
  isValidRequest(): boolean {
    this.convertPropertyTypes();
    const valid = validate(this.properties, this.resourcePropertiesSchema);
    if (!valid) {
      // TODO: improve error message with why it failed validation, requires upstream changes
      this.fail("invalid resource properties: " + this.properties);
    }
    return valid;
  }

  /**
   * returns true if request is `isSupportedResourceType`.
   * If false, self.reason and self.status are set.
   */
  isSupportedRequest(): boolean {
    const supported = this.isSupportedResourceType();
    if (!supported) {
      this.fail(
        "ResourceType " +
          this.resourceType +
          " not supported by provider " +
          this.customCfnResourceName,
      );
    }
    return supported;
  }

  /**
   * sets the attribute `name` to `value`. This value can be retrieved using "Fn::GetAtt".
   */
  setAttribute(name: string, value: any) {
    if (this.response!.Data === undefined) {
      this.response!.Data = {};
    }
    this.response!.Data[name] = value;
  }

  /**
   * returns the value of the attribute `name`.
   */
  getAttribute(name: string): any | undefined {
    if (this.response!.Data === undefined) {
      return undefined;
    }
    return this.response!.Data[name];
  }

  /**
   * sets response status to SUCCESS, with an optional reason.
   */
  success(reason?: string) {
    this.response!.Status = SUCCESS;
    if (!(reason === undefined)) {
      this.response!.Reason = reason;
    }
  }

  /**
   * sets response status to FAILED
   */
  fail(reason: string) {
    this.response!.Status = "FAILED";
    if (reason) this.response!.Reason = reason;
  }

  /**
   * create the custom resource
   */
  create() {
    this.fail("create not implemented by " + this.constructor.name);
  }

  /**
   * update the custom resource
   */
  update() {
    this.fail("update not implemented by " + this.constructor.name);
  }

  /**
   * delete the custom resource
   */
  delete() {
    this.success("delete not implemented by " + this.constructor.name);
  }

  /**
   * execute the request.
   */
  execute() {
    try {
      if (this.isSupportedRequest() && this.isValidRequest()) {
        if (this.requestType == "Create") {
          this.create();
        } else if (this.requestType == "Update") {
          this.update();
        } else {
          // TODO: assert request type is "Delete"
          this.delete();
        }
        this.isValidCfnResponse();
      } else if (
        "RequestType" in this.request! &&
        this.requestType == "Delete"
      ) {
        /**
         * failure to delete an invalid request hangs your cfn...
         */
        this.success();
      }
    } catch (e: any) {
      if (this.status == SUCCESS) {
        this.fail(e.toString());
      }
      console.error(e);
    } finally {
      if (!this.physicalResourceId && this.status == FAILED) {
        /**
         * CFN will complain if the physicalResourceId is not set on failure
         * to create the physical resource. :-(
         */
        if (this.requestType == "Create") {
          this.physicalResourceId = "could-not-create";
        }
      }
    }
  }

  /**
   * handles the CloudFormation request.
   */
  public handle(
    request: CloudFormationCustomResourceEvent,
    context: Context,
  ): CloudFormationCustomResourceResponse {
    console.debug("received request " + JSON.stringify(request));
    this.setRequest(request, context);
    this.execute();
    if (!this.asynchronous) {
      this.sendResponse();
    }
    return this.response!;
  }

  /**
   * truncates the response to 200 characters to avoid exceeding the limit.
   */
  private truncateResponse() {
    if (!this.reason) {
      return;
    }
    if (this.reason.length > 200) {
      console.error(
        "truncating Reason to 200 characters to avoid exceeding the, " +
          this.reason,
      );
      this.reason = this.reason.substring(0, 200) + "...";
    }
  }

  /**
   * sends the response to `ResponseURL`
   */
  sendResponse() {
    this.truncateResponse();
    const url = this.request!.ResponseURL;
    console.debug(
      "sending response to " + url + " ->  " + JSON.stringify(this.response),
    );
    // TODO: maybe replace
    send(
      this.request!,
      this.context!,
      this.status,
      this.response!.Data,
      this.physicalResourceId,
      this.noEcho,
    );
  }
}
