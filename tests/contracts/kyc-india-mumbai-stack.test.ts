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
