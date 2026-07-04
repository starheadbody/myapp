// Fixed vocabularies — mirror the Postgres enums exactly.
// Assets and gaps MUST come from CAPABILITY_TAGS (no free text, spec §1).

export const CAPABILITY_TAGS = [
  'technical',
  'capital',
  'domain_expertise',
  'sales',
  'time',
  'design',
  'marketing',
  'operations',
  'legal',
  'product',
] as const;
export type CapabilityTag = (typeof CAPABILITY_TAGS)[number];

export const DOMAIN_TAGS = [
  'fintech',
  'healthtech',
  'edtech',
  'climate',
  'ai_ml',
  'consumer',
  'b2b_saas',
  'marketplace',
  'hardware',
  'biotech',
  'media',
  'other',
] as const;
export type DomainTag = (typeof DOMAIN_TAGS)[number];

export const PROJECT_PHASES = [
  'idea',
  'validating',
  'building',
  'launched',
] as const; // dormant/archived are system-set, never user-selected
export type ProjectPhase =
  | (typeof PROJECT_PHASES)[number]
  | 'dormant'
  | 'archived';

export const EQUITY_MODELS = [
  'equal_split',
  'dynamic_split',
  'milestone_vested',
  'cash_plus_equity',
  'advisory_shares',
  'to_be_negotiated',
] as const;
export type EquityModel = (typeof EQUITY_MODELS)[number];

export type MatchStatus = 'proposed' | 'accepted' | 'rejected' | 'expired';

export const LEDGER_ENTRY_TYPES = [
  'submitted_artifact',
  'reached_milestone',
  'shipped_release',
  'closed_customer',
  'advisory_session',
] as const; // joined_project / project_created / dependency_filled are system-written

export function label(tag: string): string {
  return tag.replace(/_/g, ' ');
}
