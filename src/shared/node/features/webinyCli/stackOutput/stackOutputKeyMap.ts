import type { GenericRecord } from "~/shared/types.js";

/**
 * Canonical names for the infrastructure facts worth surfacing, mapped onto the raw Pulumi output
 * keys each Webiny major actually emits.
 *
 * The two majors disagree on three groups — v5 predates the OpenSearch rename and calls the audit
 * table a log table — so reading v6 key names against a v5 stack silently yields nothing. Keys are
 * also conditional on configuration: a DynamoDB-only project has no search keys at all, and VPC
 * keys appear only when VPC is enabled. Absence is normal and is reported as absence.
 */
export interface IResolvedStackOutput {
  label: string;
  value: string;
}

type KeysByMajor = { v5: string; v6: string } | { both: string };

const CORE_FIELDS: Array<{ label: string; keys: KeysByMajor }> = [
  { label: "Region", keys: { both: "region" } },
  { label: "Deployment ID", keys: { both: "deploymentId" } },
  { label: "DynamoDB table", keys: { both: "primaryDynamodbTableName" } },
  {
    label: "Audit log table",
    keys: { v5: "logDynamodbTableName", v6: "auditLogsDynamodbTableName" },
  },
  {
    label: "Search endpoint",
    keys: { v5: "elasticsearchDomainEndpoint", v6: "opensearchDomainEndpoint" },
  },
  {
    label: "Search table",
    keys: { v5: "elasticsearchDynamodbTableName", v6: "opensearchDynamodbTableName" },
  },
  { label: "File manager bucket", keys: { both: "fileManagerBucketId" } },
  { label: "Cognito user pool", keys: { both: "cognitoUserPoolId" } },
  { label: "Event bus", keys: { both: "eventBusName" } },
  { label: "VPC subnets (public)", keys: { both: "vpcPublicSubnetIds" } },
  { label: "VPC subnets (private)", keys: { both: "vpcPrivateSubnetIds" } },
  { label: "VPC security groups", keys: { both: "vpcSecurityGroupIds" } },
];

const API_FIELDS: Array<{ label: string; keys: KeysByMajor }> = [
  { label: "API URL", keys: { both: "apiUrl" } },
  { label: "Region", keys: { both: "region" } },
];

const ADMIN_FIELDS: Array<{ label: string; keys: KeysByMajor }> = [
  { label: "Admin app", keys: { both: "appUrl" } },
];

function keyFor(keys: KeysByMajor, versionMajor: number): string {
  if ("both" in keys) {
    return keys.both;
  }
  return versionMajor === 5 ? keys.v5 : keys.v6;
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value === "" ? null : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map((item) => String(item)).join(", ");
  }
  // cognitoUserPoolPasswordPolicy and friends are plain objects.
  return JSON.stringify(value);
}

function resolve(
  fields: Array<{ label: string; keys: KeysByMajor }>,
  outputs: GenericRecord<string, unknown> | null,
  versionMajor: number,
): IResolvedStackOutput[] {
  if (outputs === null) {
    return [];
  }

  const resolved: IResolvedStackOutput[] = [];
  for (const field of fields) {
    const value = stringify(outputs[keyFor(field.keys, versionMajor)]);
    if (value !== null) {
      resolved.push({ label: field.label, value });
    }
  }
  return resolved;
}

export function resolveCoreOutputs(
  outputs: GenericRecord<string, unknown> | null,
  versionMajor: number,
): IResolvedStackOutput[] {
  return resolve(CORE_FIELDS, outputs, versionMajor);
}

export function resolveApiOutputs(
  outputs: GenericRecord<string, unknown> | null,
  versionMajor: number,
): IResolvedStackOutput[] {
  return resolve(API_FIELDS, outputs, versionMajor);
}

export function resolveAdminOutputs(
  outputs: GenericRecord<string, unknown> | null,
  versionMajor: number,
): IResolvedStackOutput[] {
  return resolve(ADMIN_FIELDS, outputs, versionMajor);
}

/** The base API URL, from which the CMS endpoints are derived. */
export function readApiUrl(outputs: GenericRecord<string, unknown> | null): string | null {
  return outputs === null ? null : stringify(outputs["apiUrl"]);
}

export function readAdminUrl(outputs: GenericRecord<string, unknown> | null): string | null {
  return outputs === null ? null : stringify(outputs["appUrl"]);
}

export function readRegion(outputs: GenericRecord<string, unknown> | null): string | null {
  return outputs === null ? null : stringify(outputs["region"]);
}

/**
 * CMS endpoints are derived, never stored: operations append their own path to the base API URL,
 * so persisting them would duplicate the base and drift from it.
 */
export function deriveCmsEndpoints(apiUrl: string): IResolvedStackOutput[] {
  return [
    { label: "GraphQL API", value: `${apiUrl}/graphql` },
    { label: "CMS Manage", value: `${apiUrl}/cms/manage` },
    { label: "CMS Read", value: `${apiUrl}/cms/read` },
    { label: "CMS Preview", value: `${apiUrl}/cms/preview` },
  ];
}
