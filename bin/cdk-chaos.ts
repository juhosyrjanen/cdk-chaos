#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
// CdkChaosStack defines VPC & networking
import { CdkChaosStack } from '../lib/cdk-chaos-stack';

const app = new cdk.App();
// Create new CDK stack
new CdkChaosStack(app, 'CdkChaosStack', {
  env: { account: '678949171549', region: 'eu-north-1' },

});