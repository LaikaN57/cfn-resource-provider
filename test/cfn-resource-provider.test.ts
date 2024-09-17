import {
  CloudFormationCustomResourceEvent,
  Context,
  SNSEvent,
} from "aws-lambda";
import { send } from "cfn-response";
import { ResourceProvider, SnsEnvelope } from "../src";
import { IResourceProvider } from "../src/resource-provider";

jest.mock("cfn-response");

describe("ResourceProvider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("ResourceProvider", () => {
    const event: CloudFormationCustomResourceEvent = {
      RequestType: "Create",
      ServiceToken: "arn:aws:lambda:us-east-1:1234:function:my-function",
      ResponseURL: "https://response.url",
      StackId: "arn:aws:cloudformation:us-east-1:1234:stack/my-stack/1234",
      RequestId: "1234",
      ResourceType: "Custom::Resource",
      LogicalResourceId: "MyResource",
      ResourceProperties: {
        Property: "Value",
        ServiceToken: "arn:aws:lambda:us-east-1:1234:function:my-function",
      },
    };

    const context: Context = {
      awsRequestId: "1234",
      callbackWaitsForEmptyEventLoop: false,
      functionName: "my-function",
      functionVersion: "1",
      invokedFunctionArn: "arn:aws:lambda:us-east-1:1234:function:my-function",
      logGroupName: "my-log-group",
      logStreamName: "my-log-stream",
      memoryLimitInMB: "128",
      getRemainingTimeInMillis: () => 1000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
    };

    const resourceProvider = new ResourceProvider();
    resourceProvider.handle(event, context);

    expect(send).toHaveBeenCalledWith(
      event,
      context,
      "FAILED",
      undefined,
      "could-not-create",
      undefined,
    );
  });
});

describe("SnsEnvelope", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("SnsEnvelope", () => {
    const records: SNSEvent = {
      Records: [
        {
          EventVersion: "1",
          EventSubscriptionArn: "arn:aws:sns:us-east-1:1234:my-topic:1234",
          EventSource: "aws:sns",
          Sns: {
            SignatureVersion: "1",
            Timestamp: "2020-01-01T00:00:00.000Z",
            Signature: "signature",
            SigningCertUrl: "https://signing.cert.url",
            MessageId: "1234",
            Message: JSON.stringify({
              RequestType: "Create",
              ServiceToken:
                "arn:aws:lambda:us-east-1:1234:function:my-function",
              ResponseURL: "https://response.url",
              StackId:
                "arn:aws:cloudformation:us-east-1:1234:stack/my-stack/1234",
              RequestId: "1234",
              ResourceType: "Custom::Resource",
              LogicalResourceId: "MyResource",
              ResourceProperties: {
                Property: "Value",
                ServiceToken:
                  "arn:aws:lambda:us-east-1:1234:function:my-function",
              },
            }),
            MessageAttributes: {},
            Type: "Notification",
            UnsubscribeUrl: "https://unsubscribe.url",
            TopicArn: "arn:aws:sns:us-east-1:1234:my-topic",
          },
        },
        {
          EventVersion: "1",
          EventSubscriptionArn: "arn:aws:sns:us-east-1:1234:my-topic:1234",
          EventSource: "aws:sns",
          Sns: {
            SignatureVersion: "1",
            Timestamp: "2020-01-01T00:00:00.000Z",
            Signature: "signature",
            SigningCertUrl: "https://signing.cert.url",
            MessageId: "1234",
            Message: JSON.stringify({
              RequestType: "Create",
              ServiceToken:
                "arn:aws:lambda:us-east-1:1234:function:my-function",
              ResponseURL: "https://response.url",
              StackId:
                "arn:aws:cloudformation:us-east-1:1234:stack/my-stack/1234",
              RequestId: "1234",
              ResourceType: "Custom::Resource",
              LogicalResourceId: "MyResource",
              ResourceProperties: {
                Property: "Value",
                ServiceToken:
                  "arn:aws:lambda:us-east-1:1234:function:my-function",
              },
            }),
            MessageAttributes: {},
            Type: "Notification",
            UnsubscribeUrl: "https://unsubscribe.url",
            TopicArn: "arn:aws:sns:us-east-1:1234:my-topic",
          },
        },
        {
          EventVersion: "1",
          EventSubscriptionArn: "arn:aws:sns:us-east-1:1234:my-topic:1234",
          EventSource: "aws:sns",
          Sns: {
            SignatureVersion: "1",
            Timestamp: "2020-01-01T00:00:00.000Z",
            Signature: "signature",
            SigningCertUrl: "https://signing.cert.url",
            MessageId: "1234",
            Message: JSON.stringify({
              RequestType: "Create",
              ServiceToken:
                "arn:aws:lambda:us-east-1:1234:function:my-function",
              ResponseURL: "https://response.url",
              StackId:
                "arn:aws:cloudformation:us-east-1:1234:stack/my-stack/1234",
              RequestId: "1234",
              ResourceType: "Custom::Resource",
              LogicalResourceId: "MyResource",
              ResourceProperties: {
                Property: "Value",
                ServiceToken:
                  "arn:aws:lambda:us-east-1:1234:function:my-function",
              },
            }),
            MessageAttributes: {},
            Type: "Notification",
            UnsubscribeUrl: "https://unsubscribe.url",
            TopicArn: "arn:aws:sns:us-east-1:1234:my-topic",
          },
        },
      ],
    };

    const context: Context = {
      awsRequestId: "1234",
      callbackWaitsForEmptyEventLoop: false,
      functionName: "my-function",
      functionVersion: "1",
      invokedFunctionArn: "arn:aws:lambda:us-east-1:1234:function:my-function",
      logGroupName: "my-log-group",
      logStreamName: "my-log-stream",
      memoryLimitInMB: "128",
      getRemainingTimeInMillis: () => 1000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
    };

    const resourceProvider = new ResourceProvider();
    const snsEnvelope = new SnsEnvelope(resourceProvider);

    expect(snsEnvelope).toBeInstanceOf(SnsEnvelope);

    snsEnvelope.handle(records, context);

    expect(send).toHaveBeenCalledTimes(3);
  });
});

describe("ResourceProvider Subclass", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("ResourceProvider Subclass", () => {
    const _event: CloudFormationCustomResourceEvent = {
      RequestType: "Create",
      ServiceToken: "arn:aws:lambda:us-east-1:1234:function:my-function",
      ResponseURL: "https://response.url",
      StackId: "arn:aws:cloudformation:us-east-1:1234:stack/my-stack/1234",
      RequestId: "1234",
      ResourceType: "Custom::Resource",
      LogicalResourceId: "MyResource",
      ResourceProperties: {
        Property: "Value",
        ServiceToken: "arn:aws:lambda:us-east-1:1234:function:my-function",
      },
    };

    const _context: Context = {
      awsRequestId: "1234",
      callbackWaitsForEmptyEventLoop: false,
      functionName: "my-function",
      functionVersion: "1",
      invokedFunctionArn: "arn:aws:lambda:us-east-1:1234:function:my-function",
      logGroupName: "my-log-group",
      logStreamName: "my-log-stream",
      memoryLimitInMB: "128",
      getRemainingTimeInMillis: () => 1000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
    };

    class MyResourceProvider
      extends ResourceProvider
      implements IResourceProvider
    {
      public readonly resourcePropertiesSchema: object = { type: "object" };

      public create(): void {
        throw new Error("could-not-create");
      }

      public update(): void {
        throw new Error("could-not-update");
      }

      public delete(): void {
        throw new Error("could-not-delete");
      }
    }

    const resourceProvider = new MyResourceProvider();
    resourceProvider.handle(_event, _context);

    expect(send).toHaveBeenCalledWith(
      _event,
      _context,
      "FAILED",
      undefined,
      "could-not-create",
      undefined,
    );
  });
});
