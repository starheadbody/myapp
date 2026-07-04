import type {
  CapabilityTag,
  DomainTag,
  EquityModel,
  MatchStatus,
  ProjectPhase,
} from './tags';

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  assets: CapabilityTag[];
  gaps: CapabilityTag[];
  domain_tags: DomainTag[];
  commitment_score: number;
  proof_of_work_url: string;
  is_mentor: boolean;
}

export interface Project {
  id: string;
  owner_id: string;
  problem_statement: string;
  target_market: string;
  current_phase: ProjectPhase;
  technical_constraint: string;
  equity_model: EquityModel;
  domain_tags: DomainTag[];
  active_dependencies: CapabilityTag[];
  last_activity_at: string;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  project_id: string;
  entry_type: string;
  category: 'operational' | 'advisory';
  description: string;
  timestamp: string;
}

export interface Match {
  id: string;
  project_id: string;
  user_id: string;
  matched_on: CapabilityTag;
  status: MatchStatus;
  owner_accepted: boolean;
  candidate_accepted: boolean;
  created_at: string;
}

export interface Candidate {
  dependency: CapabilityTag;
  user_id: string;
  commitment_score: number;
  domain_overlap: number;
  proof_of_work_url: string;
}
