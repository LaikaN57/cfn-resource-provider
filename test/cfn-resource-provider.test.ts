import { CloudFormationCustomResourceEvent, Context } from "aws-lambda";
import { send } from "cfn-response";
import { ResourceProvider } from "../src";

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

    expect(new ResourceProvider().handle(event, context));
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
