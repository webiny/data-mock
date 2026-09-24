export interface WebinyRegion {
  value: string;
  label: string;
}

/**
 * The regions Webiny accepts, copied from `@webiny/project`'s `utils/regions.ts`.
 *
 * It is a closed set, not advice: `withRegion` throws `Webiny does not support region "x"` for
 * anything outside it, so a free-text field would produce a deploy that fails after the user has
 * already confirmed it. Two AWS regions Webiny itself has commented out — `eu-south-1` (Milan) and
 * `me-south-1` (Bahrain) — are absent here for the same reason they are absent there.
 */
export const WEBINY_REGIONS: WebinyRegion[] = [
  { value: "us-east-1", label: "us-east-1 (US East, N. Virginia)" },
  { value: "us-east-2", label: "us-east-2 (US East, Ohio)" },
  { value: "us-west-1", label: "us-west-1 (US West, N. California)" },
  { value: "us-west-2", label: "us-west-2 (US West, Oregon)" },
  { value: "ca-central-1", label: "ca-central-1 (Canada, Central)" },
  { value: "eu-central-1", label: "eu-central-1 (EU, Frankfurt)" },
  { value: "eu-west-1", label: "eu-west-1 (EU, Ireland)" },
  { value: "eu-west-2", label: "eu-west-2 (EU, London)" },
  { value: "eu-west-3", label: "eu-west-3 (EU, Paris)" },
  { value: "eu-north-1", label: "eu-north-1 (EU, Stockholm)" },
  { value: "af-south-1", label: "af-south-1 (Africa, Cape Town)" },
  { value: "ap-east-1", label: "ap-east-1 (Asia Pacific, Hong Kong)" },
  { value: "ap-south-1", label: "ap-south-1 (Asia Pacific, Mumbai)" },
  { value: "ap-northeast-2", label: "ap-northeast-2 (Asia Pacific, Seoul)" },
  { value: "ap-southeast-1", label: "ap-southeast-1 (Asia Pacific, Singapore)" },
  { value: "ap-southeast-2", label: "ap-southeast-2 (Asia Pacific, Sydney)" },
  { value: "ap-northeast-1", label: "ap-northeast-1 (Asia Pacific, Tokyo)" },
  { value: "sa-east-1", label: "sa-east-1 (South America, São Paulo)" },
];

export function isSupportedRegion(region: string): boolean {
  return WEBINY_REGIONS.some((candidate) => candidate.value === region);
}
