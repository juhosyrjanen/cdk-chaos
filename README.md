# Chaos testing AWS infra

This project uses AWS CDK to define and deploy AWS infrastructure. Using AWS Fault Injection Simulator, this project simulates errors in the infrastrucrture in the pipeline after changes are made to the code.

This project uses Typescript as the language for CDK. The stack is defined in ``lib/cdk-chaos-stack.ts``

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
