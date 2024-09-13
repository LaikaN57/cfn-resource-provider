import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResourcePropertiesCommon, CloudFormationCustomResourceResponse, Context } from "aws-lambda";
import { SUCCESS, FAILED, ResponseStatus, send } from "cfn-response";
import { validate } from "./default_injecting_validator";

export interface IResourceProvider {
  request_schema: object;

  create(): void;
  update(): void;
  delete(): void;
}

export enum RequestType {
  Create = "Create",
  Update = "Update",
  Delete = "Delete",
}

export type RequestTypeType = keyof typeof RequestType;

export class ResourceProvider implements IResourceProvider {
  request?: CloudFormationCustomResourceEvent;
  context?: Context;
  asynchronous: boolean = false;
  response?: CloudFormationCustomResourceResponse;
  /**
   * default json schema for request['ResourceProperties']. Override in your subclass.
   */
  request_schema: object = { type: "object" };

  get custom_cfn_resource_name(): string {
    return "Custom::" + this.constructor.name.replace("Provider", "");
  }

  is_supported_resource_type(): boolean {
    return this.resource_type == this.custom_cfn_resource_name;
  }

  /**
   * sets the lambda request to process.
   *
   * @param request the CloudFormation request
   * @param context the lambda context
   */
  set_request(request: CloudFormationCustomResourceEvent, context: Context) {
    this.request = request;
    this.context = context;
    this.asynchronous = false;
    // Setup defualt response
    this.response = {
      Status: SUCCESS,
      StackId: request.StackId,
      RequestId: request.RequestId,
      LogicalResourceId: request.LogicalResourceId,
      PhysicalResourceId: ("PhysicalResourceId" in request) ? request.PhysicalResourceId : "",
      // data, reason, noEcho
    };
  }

  /**
   * returns the custom resource property `name` if it exists, otherwise `default`
   * @param name
   * @param _default
   */
  get(name: string, _default: string) {
    if (name in this.properties) {
      return this.properties[name];
    }
    return _default;
  }

  /**
   * returns the old resource property `name` if it exists, otherwise `default`
   * @param name
   * @param _default
   */
  get_old(name: string, _default: string) {
    if (this.old_properties === undefined) {
      return _default;
    }
    if (name in this.old_properties) {
      return this.old_properties![name];
    }
    return _default;
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
  get old_properties(): CloudFormationCustomResourceResourcePropertiesCommon | undefined {
    if ("OldResourceProperties" in this.request!) {
      return this.request!.OldResourceProperties;
    }
    return undefined;
  }

  /**
   * returns the LogicaLResourceId from the request.
   */
  get logical_resource_id(): string {
    return this.request!.LogicalResourceId;
  }

  /**
   * returns the StackId from the request.
   */
  get stack_id(): string {
    return this.request!.StackId;
  }

  /**
   * returns the RequestId from the request.
   */
  get request_id(): string {
    return this.request!.RequestId;
  }

  /**
   * returns the ResponseURL from the request.
   */
  get response_url(): string {
    return this.request!.ResponseURL;
  }

  /**
   * returns the PhysicalResourceId from the response. Initialized from request.
   */
  get physical_resource_id(): string {
    return this.response!.PhysicalResourceId;
  }

  set physical_resource_id(new_resource_id: string) {
    this.response!.PhysicalResourceId = new_resource_id;
  }

  /**
   * returns the CloudFormation request type.
   */
  get request_type(): RequestTypeType {
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
  get resource_type(): string {
    return this.request!.ResourceType;
  }

  /**
   * returns the current value of NoEcho, or None if not set.
   */
  get no_echo(): boolean | undefined {
    return this.response!.NoEcho;
  }

  /**
   * sets the NoEcho in the response to `value`.
   */
  set no_echo(value: boolean) {
    this.response!.NoEcho = value;
  }

  /**
   * returns true when self.request is a valid CloudFormation custom resource request, otherwise false.
   * if false, sets self.status and self.reason.
   */
  is_valid_cfn_request(): boolean {
    const valid = validate(this.request, ResourceProvider.cfn_request_schema);
    if (!valid) {
      // TODO: improve error message with why it failed validation, requires upstream changes
      this.fail("invalid CloudFormation Request received: " + this.request);
    }
    return valid;
  }

  /**
   * returns true when self.response is a valid CloudFormation custom resource response, otherwise false.
   * if false, it logs the reason.
   */
  is_valid_cfn_response(): boolean {
    const valid = validate(this.response, ResourceProvider.cfn_response_schema);
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
  convert_property_types() {}

  /**
   * heuristic type conversion of string values in `properties`.
   * @param properties
   */
  heuristic_convert_property_types(properties: any): any {
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
        properties[i] = this.heuristic_convert_property_types(properties[i]);
      }
    } else if (properties instanceof Object) {
      for (let key in properties) {
        properties[key] = this.heuristic_convert_property_types(
          properties[key]
        );
      }
    }
    return properties;
  }

  /**
   * returns true if `self.properties` is a valid request as specified by the JSON schema self.request_schema, otherwise False.
   * Optional properties with a default value in the schema will be added to self.porperties.
   * If false, self.reason and self.status are set.
   */
  is_valid_request(): boolean {
    this.convert_property_types();
    const valid = validate(this.properties, this.request_schema);
    if (!valid) {
      // TODO: improve error message with why it failed validation, requires upstream changes
      this.fail("invalid resource properties: " + this.properties);
    }
    return valid;
  }

  /**
   * returns true if request is `is_supported_resource_type`.
   * If false, self.reason and self.status are set.
   */
  is_supported_request(): boolean {
    const supported = this.is_supported_resource_type();
    if (!supported) {
      this.fail(
        "ResourceType " +
          this.resource_type +
          " not supported by provider " +
          this.custom_cfn_resource_name
      );
    }
    return supported;
  }

  /**
   * sets the attribute `name` to `value`. This value can be retrieved using "Fn::GetAtt".
   */
  set_attribute(name: string, value: any) {
    if (this.response!.Data === undefined) {
      this.response!.Data = {};
    }
    this.response!.Data[name] = value;
  }

  /**
   * returns the value of the attribute `name`.
   */
  get_attribute(name: string): any | undefined {
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
    this.response!["Status"] = "FAILED";
    if (reason) this.response!["Reason"] = reason;
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
      if (
        this.is_supported_request() &&
        this.is_valid_cfn_request() &&
        this.is_valid_request()
      ) {
        if (this.request_type == "Create") {
          this.create();
        } else if (this.request_type == "Update") {
          this.update();
        } else {
          // TODO: assert request type is "Delete"
          this.delete();
        }
        this.is_valid_cfn_response();
      } else if (
        "RequestType" in this.request! &&
        this.request_type == "Delete"
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
      if (!this.physical_resource_id && this.status == FAILED) {
        /**
         * CFN will complain if the physical_resource_id is not set on failure
         * to create the physical resource. :-(
         */
        if (this.request_type == "Create") {
          this.physical_resource_id = "could-not-create";
        }
      }
    }
  }

  /**
   * handles the CloudFormation request.
   */
  public handle(request: CloudFormationCustomResourceEvent, context: Context): CloudFormationCustomResourceResponse {
    console.debug("received request " + JSON.stringify(request));
    this.set_request(request, context);
    this.execute();
    if (!this.asynchronous) {
      this.send_response();
    }
    return this.response!;
  }

  /**
   *
   */
  private truncate_response() {
    if (!this.reason) {
      return;
    }
    if (this.reason.length > 200) {
      console.error(
        "truncating Reason to 200 characters to avoid exceeding the, " +
          this.reason
      );
      this.reason = this.reason.substring(0, 200) + "...";
    }
  }

  /**
   * sends the response to `ResponseURL`
   */
  send_response() {
    this.truncate_response();
    const url = this.request!.ResponseURL;
    console.debug(
      "sending response to " + url + " ->  " + JSON.stringify(this.response)
    );
    // TODO: maybe replace
    send(
      this.request!,
      this.context!,
      this.status,
      this.response!.Data,
      this.physical_resource_id,
      this.no_echo
    );
  }

  /**
   * A JSON Schema which defines a proper CloudFormation request message
   */
  static readonly cfn_request_schema = {
    type: "object",
    required: [
      "RequestType",
      "ResponseURL",
      "StackId",
      "RequestId",
      "ResourceType",
      "LogicalResourceId",
      "ResourceProperties",
    ],
    properties: {
      RequestType: { type: "string", enum: ["Create", "Update", "Delete"] },
      ResponseURL: {
        type: "string",
        // format: "uri",
        pattern: "^https?://"
      },
      StackId: { type: "string" },
      RequestId: { type: "string" },
      ResourceType: { type: "string" },
      LogicalResourceId: { type: "string" },
      PhysicalResourceId: { type: "string" },
      ResourceProperties: { type: "object" },
    },
  };

  /**
   * A JSON Schema which defines a proper CloudFormation response message
   */
  static readonly cfn_response_schema = {
    type: "object",
    required: [
      "Status",
      "Reason",
      "RequestId",
      "StackId",
      "LogicalResourceId",
    ],
    properties: {
      Status: { type: "string", enum: ["SUCCESS", "FAILED"] },
      StackId: { type: "string" },
      RequestId: { type: "string" },
      LogicalResourceId: { type: "string" },
      PhysicalResourceId: { type: "string" },
      Data: { type: "object" },
    },
  };
}
