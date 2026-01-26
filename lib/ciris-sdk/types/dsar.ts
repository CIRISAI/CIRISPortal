/**
 * DSAR-related type definitions
 */

export type DSARRequestType = 'access' | 'delete' | 'export' | 'correct';
export type DSARStatus =
  | 'pending_review'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExportFormat = 'json' | 'xml' | 'csv';

export interface MultiSourceDSARRequest {
  request_type: DSARRequestType;
  email: string;
  user_identifier: string;
  export_format?: ExportFormat;
  corrections?: Record<string, string | number | boolean>;
  details?: string;
  urgent?: boolean;
}

export interface MultiSourceDSARResponse {
  success: boolean;
  data: {
    ticket_id: string;
    status: DSARStatus;
    submitted_at: string;
    estimated_completion?: string;
  };
}

export interface SourceStatus {
  source_id: string;
  source_name: string;
  source_type: 'ciris' | 'sql' | 'rest' | 'hl7';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress_percentage?: number;
  error_message?: string;
  completed_at?: string;
}

export interface MultiSourceDSARStatusResponse {
  ticket_id: string;
  request_type: DSARRequestType;
  email: string;
  user_identifier: string;
  status: DSARStatus;
  submitted_at: string;
  completed_at?: string;
  sources: SourceStatus[];
  overall_progress_percentage: number;
}

export interface PartialResultsResponse {
  ticket_id: string;
  sources_completed: number;
  sources_total: number;
  results: {
    source_id: string;
    source_name: string;
    data: unknown;
    retrieved_at: string;
  }[];
}

export interface DSARTicketSummary {
  ticket_id: string;
  request_type: DSARRequestType;
  email: string;
  status: DSARStatus;
  submitted_at: string;
  completed_at?: string;
  urgent: boolean;
}

export interface DSARListResponse {
  tickets: DSARTicketSummary[];
  total: number;
  page: number;
  page_size: number;
}
