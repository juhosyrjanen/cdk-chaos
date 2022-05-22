# Chaos testing AWS infra with AWS FIS

> This project uses AWS CDK to define and deploy AWS infrastructure. Using AWS Fault Injection Simulator (FIS), this project simulates errors in one AZ.

This project uses Typescript as the language for CDK. The stack is defined in ``lib/cdk-chaos-stack.ts``

### Infrastructure consist of: 

- A basic AWS VPC along with its subnets and default routes.
- An AutoScaling group with EC2 instances running Amazon Linux with basic Apache webserver.
- A CloudWatch metrics & alarm set to monitor amout of instances terminating in the AutoScaling Group.
- IAM role & policy to allow AWS FIS to terminate EC2 instaces

The CDK code also defines AWS FIS with targets, actions and experiments to terminate EC2 instances inside the AutoScaling Group.

AWS FIS experiment is set to halt if CloudWatch alarm is triggered.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
