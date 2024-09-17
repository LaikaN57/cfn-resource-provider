/**
 * This module provides a class for handling SNS envelopes for CloudFormation custom resources.
 */

import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
  SNSEvent,
} from "aws-lambda";
import { ResourceProvider } from "./resource-provider";

/**
 * Represents an SNS envelope for handling CloudFormation custom resources.
 */
export class SnsEnvelope {
  /**
   * The provider for the SNS envelope.
   */
  provider: ResourceProvider;

  /**
   * Constructs a new instance of the SnsEnvelope class.
   *
   * When custom resources are SNS backed the CloudFormation event is wrapped within the SNS structure. To make it easier to process these custom resources we created an Envelope that can unpack the SNS messages.
   *
   * @param resourceProvider - The resource provider.
   */
  constructor(resourceProvider: ResourceProvider) {
    this.provider = resourceProvider;
  }

  /**
   * Handles the SNSEvent and returns an array of CloudFormationCustomResourceResponse.
   *
   * @param event - The SNSEvent object containing the event records.
   * @param context - The AWS Lambda context object.
   * @returns An array of CloudFormationCustomResourceResponse objects.
   */
  handle(
    event: SNSEvent,
    context: Context,
  ): CloudFormationCustomResourceResponse[] {
    const responses: CloudFormationCustomResourceResponse[] = [];

    for (const record of event.Records) {
      const request: CloudFormationCustomResourceEvent = JSON.parse(
        record.Sns.Message,
      );
      responses.push(this.provider.handle(request, context));
    }

    return responses;
  }
}
