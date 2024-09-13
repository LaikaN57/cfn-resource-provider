import { Ajv } from "ajv";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
  SNSEvent,
} from "aws-lambda";
import { ResourceProvider } from "./resource_provider";

const SNS_SCHEMA = {
  type: "object",
  required: ["Records"],
  additionalProperties: true,
  properties: {
    Records: {
      type: "array",
      items: { $ref: "#/$defs/sns" },
    },
  },
  $defs: {
    sns: {
      type: "object",
      required: ["Sns"],
      properties: {
        Sns: {
          type: "object",
          required: ["Message"],
          properties: {
            Message: {
              type: "string",
            },
          },
        },
      },
    },
  },
};

export class SnsEnvelope {
  provider: ResourceProvider;

  /**
   * When custom resources are SNS backed the CloudFormation event is wrapped within the SNS structure. To make
   * it easier to process these custom resources we created an Envelope that can unpack the SNS messages.
   */
  constructor(resource_provider: ResourceProvider) {
    this.provider = resource_provider;
  }

  handle(
    event: SNSEvent,
    context: Context,
  ): CloudFormationCustomResourceResponse[] {
    /**
     * SNS payloads can hold 1 or more messages, so we need to handle each message as a custom resource.
     */
    if (!this.is_valid_sns_request(event)) {
      throw new Error(
        "The provided event is not compliant with the SNS schema.",
      );
    }

    const responses = [];

    for (const record of event.Records) {
      const request: CloudFormationCustomResourceEvent = JSON.parse(
        record.Sns.Message,
      );

      responses.push(this.provider.handle(request, context));
    }

    return responses;
  }

  private is_valid_sns_request(event: object): boolean {
    const ajv = new Ajv();
    const valid = ajv.validate(SNS_SCHEMA, event);
    if (!valid) {
      this.provider.fail("invalid CloudFormation Request received: " + event);
    }
    return valid;
  }
}
