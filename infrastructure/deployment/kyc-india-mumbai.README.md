# Mumbai KYC evidence stack candidate

**Owner:** `services/api-gateway` for upload intent, signed S3 HEAD, review and cleanup; `services/queue-workers` for scan-result polling. **Status:** source candidate only. The owner confirmed on 2026-11-02 that no AWS account is ready. This stack has not been deployed or validated by AWS. The API and worker deliberately allow the India flow only in `ENVIRONMENT=test` until the real-account gate below passes.

`kyc-india-mumbai.cfn.json` defines a private, versioned, SSE-S3 bucket with public access blocked and CORS limited to one exact HTTPS Merchant origin. Deleting or replacing the stack retains the bucket. It defines a GuardDuty Malware Protection plan for `kyc/`, a same-region EventBridge scan-result rule, an encrypted SQS queue, and a dead-letter queue. The queue policy limits EventBridge sends to this rule and account. No replication configuration or public URL is defined. The stack stores no AWS access key or KYC document.

The template is **not** the whole production path. It does not create the separate least-privilege principals and managed secrets for STS upload, version-specific HEAD, reviewer GET, version cleanup, or SQS polling. It does not implement a retention period, an alarm on GuardDuty plan status or the dead-letter queue, or a provider verification contract. Those require account-specific review and the agreed privacy/retention policy.

Local source validation is `python3 -m json.tool infrastructure/deployment/kyc-india-mumbai.cfn.json >/dev/null` followed by `node --import tsx --test tests/contracts/kyc-india-mumbai-stack.test.ts`. These check JSON and important static security relationships; they do not replace AWS `validate-template`, change-set review, or a real scan-delivery test.

## Review and apply sequence

1. The owner creates and controls the AWS account. Record its 12-digit ID privately; do not paste credentials into chat or source. Select `ap-south-1` for the stack and verify the intended account with `aws sts get-caller-identity` before any change set. Use different stacks, buckets, origins, principals, and secrets for test/staging and production.
2. Review the template, exact Merchant HTTPS origin, globally unique bucket name, IAM service role, all resource costs, retention policy, and CloudFormation change set. The [AWS CLI deploy command](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html) supports `--no-execute-changeset` for this review:

   ```sh
   aws cloudformation deploy --region ap-south-1 \
     --template-file infrastructure/deployment/kyc-india-mumbai.cfn.json \
     --stack-name letbuyy-kyc-test \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides BucketName=OWNER_UNIQUE_BUCKET MerchantOrigin=https://OWNER_MERCHANT_HOST ScanRuleName=letbuyy-kyc-test-scan \
     --no-execute-changeset
   ```

   Execute the reviewed change set only through the deployment approval gate. The bucket must be empty of real KYC documents until the rest of this gate is complete.
3. Read back the account, bucket Region, versioning, encryption, public-access block, CORS, bucket policy, and absence of a replication configuration. Wait for versioning propagation before a first write; [AWS recommends 15 minutes](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-s3-bucket.html) after initial enablement. Confirm the GuardDuty plan reports `ACTIVE`, its exact ARN matches the Worker configuration, and it scans an uploaded **synthetic** PDF/JPEG/PNG object in Mumbai. [GuardDuty scans in the bucket's Region](https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html) and sends scan results to the default regional EventBridge bus. A plan in `WARNING` or `ERROR` is not accepted.
4. Create separate least-privilege principals outside this template: an STS source allowed to assume one upload role restricted by the API's exact-object session policy; HEAD allowed only on `kyc/*`; reviewer GET allowed only on `kyc/*`; cleanup allowed `ListBucketVersions` on `kyc/*` and `DeleteObjectVersion` on those keys; Worker allowed `ReceiveMessage` and `DeleteMessage` on this one scan queue. Store credentials in managed environment secrets, separate by environment. Do not use root credentials or a shared all-purpose key. Prove each principal is denied the other actions and any other bucket.
5. Run a synthetic direct browser and mobile POST through the real S3 origin. Confirm a version-specific 201 and checksum, the API's authenticated HEAD/readback of that exact version, a GuardDuty clean and threat result arriving through the actual SQS queue, duplicate/early/wrong-version rejection, a Console reasoned clean-only review, and replacement/orphan version cleanup. Record the exact account, bucket, plan, queue, site, receipt and object version in restricted evidence, without document bytes, access keys, or signed URLs. Alarm and investigate skipped/failed scans, plan degradation, queue age, and dead-letter messages.
6. Only after the AWS, provider, privacy, security, finance, and hosted gates pass should an explicit production configuration change remove the code's `ENVIRONMENT=test` restriction. A bucket and scan plan alone cannot make a merchant verified or enable payouts.

## Source contracts and external references

- The API signs a short-lived exact-key POST and pins a version-specific S3 HEAD before attaching evidence. The Worker validates the GuardDuty account, Mumbai Region, plan ARN, bucket, key and version; accepted scan results are idempotent. These are currently synthetic tests.
- [CloudFormation GuardDuty plan](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-guardduty-malwareprotectionplan.html), [GuardDuty IAM permissions](https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection-s3-iam-policy-prerequisite.html), [scan-result EventBridge event](https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html), [S3 bucket properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-s3-bucket.html), and [S3 CORS behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html) are the primary contracts to recheck during deployment review.
