import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

const template = JSON.parse(readFileSync(resolve('infrastructure/deployment/kyc-india-mumbai.cfn.json'), 'utf8')) as {
  Parameters: Record<string, Record<string, unknown>>;
  Resources: Record<string, { Type: string; Properties: Record<string, unknown>; DependsOn?: string[]; DeletionPolicy?: string; UpdateReplacePolicy?: string }>;
};
const resource = (name: string) => {
  const value = template.Resources[name];
  assert.ok(value, `missing ${name}`);
  return value;
};
const json = (value: unknown) => JSON.stringify(value);

test('KYC evidence bucket is retained, private, versioned, encrypted and scoped to an exact Merchant origin', () => {
  const bucket = resource('PrivateEvidenceBucket');
  assert.equal(bucket.Type, 'AWS::S3::Bucket');
  assert.equal(bucket.DeletionPolicy, 'Retain');
  assert.equal(bucket.UpdateReplacePolicy, 'Retain');
  assert.deepEqual(bucket.Properties.VersioningConfiguration, { Status: 'Enabled' });
  assert.deepEqual(bucket.Properties.BucketEncryption, {
    ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
  });
  assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
  });
  assert.equal(json(bucket.Properties.OwnershipControls).includes('BucketOwnerEnforced'), true);
  assert.equal(bucket.Properties.ReplicationConfiguration, undefined);
  assert.equal(bucket.Properties.WebsiteConfiguration, undefined);
  const cors = bucket.Properties.CorsConfiguration as { CorsRules: Array<Record<string, unknown>> };
  assert.equal(cors.CorsRules.length, 1);
  assert.deepEqual(cors.CorsRules[0].AllowedOrigins, [{ Ref: 'MerchantOrigin' }]);
  assert.deepEqual(cors.CorsRules[0].AllowedMethods, ['POST']);
  assert.deepEqual(cors.CorsRules[0].ExposedHeaders, ['x-amz-version-id']);
  assert.match(String(template.Parameters.MerchantOrigin.AllowedPattern), /https:/);
  assert.ok(!json(bucket.Properties).includes('us-east-1'));
  assert.ok(!json(bucket.Properties).includes('"AllowedOrigins":["*"]'));
  assert.match(json(resource('PrivateEvidenceBucketPolicy').Properties), /aws:SecureTransport/);
});

test('GuardDuty scans only the KYC prefix using the documented same-account service role', () => {
  const plan = resource('MalwareProtectionPlan');
  assert.equal(plan.Type, 'AWS::GuardDuty::MalwareProtectionPlan');
  assert.deepEqual((plan.Properties.ProtectedResource as { S3Bucket: unknown }).S3Bucket, {
    BucketName: { Ref: 'PrivateEvidenceBucket' }, ObjectPrefixes: ['kyc/'],
  });
  assert.deepEqual(plan.Properties.Role, { 'Fn::GetAtt': ['MalwareScanRole', 'Arn'] });
  assert.deepEqual(plan.Properties.Actions, { Tagging: { Status: 'ENABLED' } });
  const role = resource('MalwareScanRole');
  assert.equal(role.Type, 'AWS::IAM::Role');
  assert.match(json(role.Properties.AssumeRolePolicyDocument), /malware-protection-plan\.guardduty\.amazonaws\.com/);
  const policy = json(role.Properties.Policies);
  for (const action of ['events:PutRule', 'events:PutTargets', 's3:GetObjectVersion',
    's3:PutObjectVersionTagging', 's3:PutBucketNotification', 's3:ListBucket']) {
    assert.ok(policy.includes(action), `${action} required by GuardDuty plan`);
  }
  assert.ok(policy.includes('DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3'));
  assert.ok(!policy.includes('kms:Decrypt'), 'SSE-S3 candidate must not grant unrelated KMS access');
  const statements = (role.Properties.Policies as Array<{ PolicyDocument: { Statement: Array<Record<string, unknown>> } }>)[0]
    .PolicyDocument.Statement;
  const scanned = statements.find(statement => statement.Sid === 'ReadAndTagScannedVersions');
  assert.deepEqual(scanned?.Resource, { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/kyc/*' });
  const validation = statements.filter(statement =>
    statement.Sid === 'PutGuardDutyValidationObject' || statement.Sid === 'ReadGuardDutyValidationObject');
  assert.deepEqual(validation.map(statement => statement.Action), ['s3:PutObject', 's3:GetObject']);
  assert.deepEqual(validation.map(statement => statement.Resource), [
    { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/malware-protection-resource-validation-object' },
    { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/malware-protection-resource-validation-object' },
  ]);
  assert.ok(!policy.includes('${PrivateEvidenceBucket.Arn}/*'), 'scanner may not read unrelated bucket objects');
});

test('scan results reach an encrypted same-region queue with exact-rule sender authority and a dead-letter path', () => {
  const queue = resource('ScanResultQueue');
  const dlq = resource('ScanResultDeadLetterQueue');
  assert.equal(queue.Type, 'AWS::SQS::Queue');
  assert.equal(queue.Properties.SqsManagedSseEnabled, true);
  assert.equal(dlq.Properties.SqsManagedSseEnabled, true);
  assert.equal(queue.Properties.VisibilityTimeout, 300);
  assert.deepEqual(queue.Properties.RedrivePolicy, {
    deadLetterTargetArn: { 'Fn::GetAtt': ['ScanResultDeadLetterQueue', 'Arn'] }, maxReceiveCount: 12,
  });
  const rule = resource('ScanResultRule');
  assert.deepEqual(rule.DependsOn, ['ScanResultQueuePolicy', 'ScanResultDeadLetterQueuePolicy']);
  const pattern = rule.Properties.EventPattern as Record<string, unknown>;
  assert.deepEqual(pattern.source, ['aws.guardduty']);
  assert.deepEqual(pattern['detail-type'], ['GuardDuty Malware Protection Object Scan Result']);
  assert.deepEqual(pattern.region, ['ap-south-1']);
  assert.deepEqual(pattern.resources, [{ 'Fn::GetAtt': ['MalwareProtectionPlan', 'Arn'] }]);
  assert.deepEqual(pattern.detail, { s3ObjectDetails: { bucketName: [{ Ref: 'PrivateEvidenceBucket' }] } });
  const target = (rule.Properties.Targets as Array<Record<string, unknown>>)[0];
  assert.deepEqual(target.Arn, { 'Fn::GetAtt': ['ScanResultQueue', 'Arn'] });
  assert.deepEqual(target.DeadLetterConfig, { Arn: { 'Fn::GetAtt': ['ScanResultDeadLetterQueue', 'Arn'] } });
  for (const policyName of ['ScanResultQueuePolicy', 'ScanResultDeadLetterQueuePolicy']) {
    const policy = json(resource(policyName).Properties.PolicyDocument);
    assert.match(policy, /events\.amazonaws\.com/);
    assert.match(policy, /aws:SourceArn/);
    assert.match(policy, /aws:SourceAccount/);
    assert.match(policy, /ap-south-1/);
    assert.ok(!policy.includes('"Principal":"*"'));
  }
});

test('application IAM identities are separate, scoped to KYC objects or one queue, and contain no credentials', () => {
  const expected: Record<string, { actions: string[]; target: unknown }> = {
    HeadUser: { actions: ['s3:GetObject', 's3:GetObjectVersion'],
      target: { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/kyc/*' } },
    ReviewUser: { actions: ['s3:GetObject', 's3:GetObjectVersion'],
      target: { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/kyc/*' } },
    ScanPollUser: { actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage'],
      target: { 'Fn::GetAtt': ['ScanResultQueue', 'Arn'] } },
  };
  for (const [name, requirement] of Object.entries(expected)) {
    const user = resource(name);
    assert.equal(user.Type, 'AWS::IAM::User');
    const statement = ((user.Properties.Policies as Array<{ PolicyDocument: { Statement: Array<Record<string, unknown>> } }>)[0].PolicyDocument.Statement);
    assert.equal(statement.length, 1);
    assert.deepEqual(statement[0].Action, requirement.actions);
    assert.deepEqual(statement[0].Resource, requirement.target);
    if (name === 'ReviewUser') assert.deepEqual(statement[0].Condition, {
      StringEquals: { 's3:ExistingObjectTag/GuardDutyMalwareScanStatus': 'NO_THREATS_FOUND' },
    });
    else assert.equal(statement[0].Condition, undefined);
  }
  const source = resource('UploadSourceUser');
  assert.equal(source.Type, 'AWS::IAM::User');
  assert.equal(source.Properties.Policies, undefined);
  const sourcePolicy = resource('UploadSourcePolicy');
  assert.equal(sourcePolicy.Type, 'AWS::IAM::UserPolicy');
  assert.deepEqual(sourcePolicy.Properties.UserName, { Ref: 'UploadSourceUser' });
  assert.deepEqual((sourcePolicy.Properties.PolicyDocument as { Statement: unknown[] }).Statement, [{
    Effect: 'Allow', Action: 'sts:AssumeRole', Resource: { 'Fn::GetAtt': ['UploadRole', 'Arn'] },
  }]);
  const uploadRole = resource('UploadRole');
  assert.deepEqual((uploadRole.Properties.AssumeRolePolicyDocument as { Statement: unknown[] }).Statement, [{
    Effect: 'Allow', Principal: { AWS: { 'Fn::GetAtt': ['UploadSourceUser', 'Arn'] } },
    Action: 'sts:AssumeRole',
  }]);
  assert.deepEqual((uploadRole.Properties.Policies as Array<{ PolicyDocument: { Statement: unknown[] } }>)[0]
    .PolicyDocument.Statement, [{ Effect: 'Allow', Action: 's3:PutObject',
      Resource: { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/kyc/*' },
      Condition: { StringEquals: { 's3:x-amz-server-side-encryption': 'AES256' } } }]);
  const cleanup = (resource('CleanupUser').Properties.Policies as Array<{ PolicyDocument: { Statement: unknown[] } }>)[0]
    .PolicyDocument.Statement;
  assert.deepEqual(cleanup, [
    { Effect: 'Allow', Action: 's3:ListBucketVersions',
      Resource: { 'Fn::GetAtt': ['PrivateEvidenceBucket', 'Arn'] },
      Condition: { StringLike: { 's3:prefix': 'kyc/*' } } },
    { Effect: 'Allow', Action: 's3:DeleteObjectVersion',
      Resource: { 'Fn::Sub': '${PrivateEvidenceBucket.Arn}/kyc/*' } },
  ]);
  for (const name of ['UploadSourceUser', 'HeadUser', 'ReviewUser', 'CleanupUser', 'ScanPollUser']) {
    const user = resource(name);
    assert.equal(user.Properties.LoginProfile, undefined);
    assert.equal(user.Properties.UserName, undefined);
    assert.equal(user.Properties.ManagedPolicyArns, undefined);
  }
  assert.ok(!json(template.Resources).includes('AWS::IAM::AccessKey'));
  assert.ok(!json(template.Resources).includes('"Action":"*"'));
  assert.ok(!json(template.Resources).includes('"Resource":"*"'));
});

test('scan-result dead letters and queue age notify an owner-controlled operations mailbox', () => {
  const topic = resource('OpsAlertTopic');
  assert.equal(topic.Type, 'AWS::SNS::Topic');
  assert.deepEqual(topic.Properties.Subscription, [{
    Protocol: 'email', Endpoint: { Ref: 'OpsAlertEmail' },
  }]);
  assert.equal(template.Parameters.OpsAlertEmail.Type, 'String');
  const alarms = [
    ['ScanResultDeadLetterAlarm', 'ApproximateNumberOfMessagesVisible',
      'ScanResultDeadLetterQueue', 1],
    ['ScanResultAgeAlarm', 'ApproximateAgeOfOldestMessage', 'ScanResultQueue', 600],
  ] as const;
  for (const [name, metric, queue, threshold] of alarms) {
    const alarm = resource(name);
    assert.equal(alarm.Type, 'AWS::CloudWatch::Alarm');
    assert.equal(alarm.Properties.Namespace, 'AWS/SQS');
    assert.equal(alarm.Properties.MetricName, metric);
    assert.deepEqual(alarm.Properties.Dimensions, [{
      Name: 'QueueName', Value: { 'Fn::GetAtt': [queue, 'QueueName'] },
    }]);
    assert.equal(alarm.Properties.Threshold, threshold);
    assert.equal(alarm.Properties.ComparisonOperator, 'GreaterThanOrEqualToThreshold');
    assert.deepEqual(alarm.Properties.AlarmActions, [{ Ref: 'OpsAlertTopic' }]);
    assert.deepEqual(alarm.DependsOn, ['OpsAlertTopicPolicy']);
    assert.deepEqual(alarm.Properties.AlarmName, { 'Fn::Sub':
      `letbuyy-kyc-${'${ScanRuleName}'}-${name === 'ScanResultDeadLetterAlarm' ? 'dlq' : 'age'}` });
  }
});

test('only exact queue alarms and exact-plan failure events can publish redacted operational alerts', () => {
  const policy = resource('OpsAlertTopicPolicy');
  assert.equal(policy.Type, 'AWS::SNS::TopicPolicy');
  assert.deepEqual(policy.Properties.Topics, [{ Ref: 'OpsAlertTopic' }]);
  const statements = (policy.Properties.PolicyDocument as { Statement: Array<Record<string, unknown>> }).Statement;
  const cloudwatch = statements.find(entry => entry.Sid === 'OnlyThisStacksQueueAlarmsMayPublish');
  assert.deepEqual(cloudwatch?.Principal, { Service: 'cloudwatch.amazonaws.com' });
  assert.deepEqual(cloudwatch?.Action, 'sns:Publish');
  assert.deepEqual(cloudwatch?.Condition, {
    ArnEquals: { 'aws:SourceArn': [
      { 'Fn::Sub': 'arn:aws:cloudwatch:ap-south-1:${AWS::AccountId}:alarm:letbuyy-kyc-${ScanRuleName}-dlq' },
      { 'Fn::Sub': 'arn:aws:cloudwatch:ap-south-1:${AWS::AccountId}:alarm:letbuyy-kyc-${ScanRuleName}-age' },
    ] },
    StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
  });
  const eventPublisher = statements.find(entry => entry.Sid === 'OnlyThisPlanHealthRuleMayPublish');
  assert.deepEqual(eventPublisher?.Principal, { Service: 'events.amazonaws.com' });
  assert.deepEqual(eventPublisher?.Condition, {
    ArnEquals: { 'aws:SourceArn': { 'Fn::Sub':
      'arn:aws:events:ap-south-1:${AWS::AccountId}:rule/${ScanHealthRuleName}' } },
    StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
  });
  assert.ok(!json(statements).includes('"Action":"sns:*"'));
  const health = resource('ScanHealthRule');
  assert.equal(health.Type, 'AWS::Events::Rule');
  assert.deepEqual((health.Properties.EventPattern as Record<string, unknown>)['detail-type'], [
    'GuardDuty Malware Protection Resource Status Warning',
    'GuardDuty Malware Protection Resource Status warning',
    'GuardDuty Malware Protection Resource Status Error',
    'GuardDuty Malware Protection Resource Status error',
    'GuardDuty Malware Protection Post Scan Action Failed',
  ]);
  assert.deepEqual((health.Properties.EventPattern as Record<string, unknown>).resources,
    [{ 'Fn::GetAtt': ['MalwareProtectionPlan', 'Arn'] }]);
  const target = (health.Properties.Targets as Array<Record<string, unknown>>)[0];
  assert.deepEqual(target.Arn, { Ref: 'OpsAlertTopic' });
  assert.deepEqual(target.InputTransformer, {
    InputPathsMap: { eventType: '$.detail-type' },
    InputTemplate: '"LetBuyy KYC GuardDuty alert: <eventType>. Inspect the restricted AWS console."',
  });
  assert.ok(!json(target.InputTransformer).includes('objectKey'));
  const dlq = json(resource('ScanResultDeadLetterQueuePolicy').Properties.PolicyDocument);
  assert.ok(dlq.includes('${ScanHealthRuleName}'));
  assert.ok(dlq.includes('${ScanRuleName}'));
});

test('all resource references resolve and the stack has no dependency cycle', () => {
  const names = new Set([...Object.keys(template.Parameters), ...Object.keys(template.Resources)]);
  const graph = new Map<string, Set<string>>();
  const refs = (value: unknown, found: Set<string>): void => {
    if (Array.isArray(value)) { for (const entry of value) refs(entry, found); return; }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.Ref === 'string' && !record.Ref.startsWith('AWS::')) {
      assert.ok(names.has(record.Ref), `unknown Ref ${record.Ref}`);
      found.add(record.Ref);
    }
    if (Array.isArray(record['Fn::GetAtt'])) {
      const target = record['Fn::GetAtt'][0];
      assert.ok(typeof target === 'string' && names.has(target), `unknown GetAtt ${String(target)}`);
      found.add(target);
    }
    if (typeof record['Fn::Sub'] === 'string') {
      for (const match of record['Fn::Sub'].matchAll(/\$\{([^}]+)\}/g)) {
        const target = match[1].split('.')[0];
        if (!target.startsWith('AWS::')) {
          assert.ok(names.has(target), `unknown Sub ${target}`);
          found.add(target);
        }
      }
    }
    for (const entry of Object.values(record)) refs(entry, found);
  };
  for (const [name, entry] of Object.entries(template.Resources)) {
    const found = new Set<string>(entry.DependsOn || []);
    refs(entry.Properties, found);
    for (const target of found) assert.ok(names.has(target), `unknown dependency ${target}`);
    graph.set(name, new Set([...found].filter(target => target in template.Resources)));
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (name: string): void => {
    assert.ok(!visiting.has(name), `resource dependency cycle at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const target of graph.get(name) || []) visit(target);
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of graph.keys()) visit(name);
});
