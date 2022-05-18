import * as cdk from '@aws-cdk/core';
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
//import { aws_fis as fis } from "aws-cdk-lib";
import * as fis from '@aws-cdk/aws-fis';
import * as cw from '@aws-cdk/aws-cloudwatch'

export class CdkChaosStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC definition
    const vpc = new Vpc(this, 'chaosVPC',{
    // Number of availability zones
    maxAzs: 2, 
    // Add subnets per AZ 
      subnetConfiguration:  [
        {
          cidrMask: 24,
          name: 'chaosSubnet',
          subnetType: SubnetType.PUBLIC
        },
      ]
    });

    //Install WebServer on ec2 instances
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo su',
      'yum install -y httpd',
      'echo "<h1>CDK Chaos testing demo machine $(hostname -f)</h1>" > /var/www/html/index.html',
      'systemctl start httpd',
      'systemctl enable httpd',
    );

    // ASG definition
    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      userData,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      minCapacity: 2,
      maxCapacity: 5,
      // Send Metrics to CloudWatch
      groupMetrics: [autoscaling.GroupMetrics.all()],
    });
  
    // Add tags to ASG resources
    cdk.Tags.of(asg).add('FIS','True');

    // LB definition
    const lb = new elbv2.ApplicationLoadBalancer(this, 'chaosLB', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 80,
    });
    
    // Output Loadbalancer DNS name
    new cdk.CfnOutput(this, 'albDNS', {
      value: lb.loadBalancerDnsName,
    });

    // Add ASG as ALB target
    listener.addTargets('Target', {
      port: 80,
      targets: [asg],
      healthCheck: {
        port: '80',
        path: '/',
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 5,
        interval: cdk.Duration.seconds(10),
      },
    });

    // Allow 0.0.0.0/0
    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');
    
    // ASG Scaling metric
    asg.scaleOnRequestCount('scalePerRequest', {
      targetRequestsPerMinute: 60,
    });    
    
    // CloudWatch Setup
    // FIS Stop Condition

    const alarm = new cw.Alarm(this, "cw-alarm", {
      alarmName: "Ec2TooManyTerminating",
      metric: new cw.Metric({
        metricName: "GroupTerminatingInstances",
        namespace: "AWS/AutoScaling",
      }).with({
        period: cdk.Duration.seconds(10),
      }),
      threshold: 2,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      datapointsToAlarm: 1,
    });

    new cdk.CfnOutput(this, "StopConditionArn", {
      value: alarm.alarmArn,
      description: "The Arn of the Stop-Conditioin CloudWatch Alarm",
      exportName: "StopConditionArn",
    });
   
    // FIS Setup
    // Create IAM permission policy
    const terminateEc2 = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['arn:aws:ec2:*:*:instance/*'],
          actions: ['ec2:TerminateInstances'],
        }),
      ],
    }); 

   // Create IAM role for FIS
    const role = new iam.Role(this, 'ec2-terminate-role', {
      assumedBy: new iam.ServicePrincipal('fis.amazonaws.com'),
      description: 'IAM role to allow EC2 termination',
      inlinePolicies: {
        terminateEc2instances: terminateEc2,
      },
    });


    // FIS Target, all instances inside ASG 
    const TargetAllInstancesASG: fis.CfnExperimentTemplate.ExperimentTemplateTargetProperty =
      {
        resourceType: "aws:ec2:instance",
        selectionMode: "ALL",
        resourceTags: {
          "Name": asg.toString(),
        },
        filters: [
          {
            path: "State.Name",
            values: ["running"],
          },
        ],
      };    

    // FIS Action, terminate instance inside ASG
    const terminateInstanceAction: fis.CfnExperimentTemplate.ExperimentTemplateActionProperty =
      {
        actionId: "aws:ec2:terminate-instances",
        parameters: {},
        targets: {
          Instances: "instanceTargets",
        },
      };

    // FIS Experiment, EC2 Instance termination
   const TerminateInstances = new fis.CfnExperimentTemplate(this, "fis-terminate instaces", {
      description: "EC2 instances are kill",
      tags: {
        Name: "Kill EC2 instances in ASG",
        Stackname: this.stackName,
      },
      roleArn: role.roleArn,
      stopConditions: [
        {
          source: "aws:cloudwatch:alarm",
          value: alarm.alarmArn,
        },
      ],
      targets: {
        instanceTargets: TargetAllInstancesASG,
      },
      actions: {
        instanceActions: terminateInstanceAction,
      },
    });
  }
}
