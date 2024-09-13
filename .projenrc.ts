import { typescript } from "projen";
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "cfn-resource-provider",
  projenrcTs: true,
  deps: [
    "@types/ajv",
    "@types/aws-lambda",
    "@types/cfn-response",
    "ajv",
    "aws-lambda",
    "cfn-response",
  ],
  description: "Base class for AWS CloudFormation Custom Resource Providers.",
  devDeps: ["@aws-sdk/client-ssm"],
  dependabot: true,
  prettier: true,
  stale: true,
  docgen: true,
});
project.vscode?.settings.addSetting("editor.formatOnSave", true);
project.synth();
