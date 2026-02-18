/**
 * Shared template presets and adapter definitions.
 *
 * Extracted from admin/agents/page.tsx to be reusable by:
 * - Agent registration dialog (admin/agents)
 * - Device auth template selection (device auth flow)
 */

// The 10 CIRIS action verbs (from CIRISAgent ciris_templates/*.yaml)
export const ALL_ACTIONS = [
  'SPEAK',
  'OBSERVE',
  'MEMORIZE',
  'RECALL',
  'DEFER',
  'REJECT',
  'PONDER',
  'TOOL',
  'FORGET',
  'TASK_COMPLETE',
] as const;

export type CIRISAction = (typeof ALL_ACTIONS)[number];

export interface TemplatePreset {
  label: string;
  tier: number;
  actions: string[];
  adapters: string[];
  description: string;
  licensed?: boolean; // Requires licensed module package download
  packageId?: string; // Licensed package ID (medical, financial, legal)
}

// Identity template presets derived from CIRISAgent ciris_templates/*.yaml
export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  echo: {
    label: 'Echo',
    tier: 4,
    actions: [
      'SPEAK',
      'OBSERVE',
      'MEMORIZE',
      'DEFER',
      'TOOL',
      'PONDER',
      'RECALL',
      'FORGET',
      'TASK_COMPLETE',
    ],
    adapters: ['ciris_accord_metrics', 'session_logs'],
    description: 'Community moderation agent (Ubuntu philosophy)',
  },
  scout: {
    label: 'Scout',
    tier: 2,
    actions: [...ALL_ACTIONS],
    adapters: ['ciris_hosted_tools', 'navigation', 'weather'],
    description: 'Sales and outreach agent',
  },
  sage: {
    label: 'Sage',
    tier: 3,
    actions: [...ALL_ACTIONS],
    adapters: ['external_data_sql', 'ciris_hosted_tools'],
    description: 'GDPR compliance automation agent',
  },
  datum: {
    label: 'Datum',
    tier: 2,
    actions: [...ALL_ACTIONS],
    adapters: ['ciris_hosted_tools', 'ciris_accord_metrics'],
    description: 'Data measurement and evaluation agent',
  },
  ally: {
    label: 'Ally',
    tier: 3,
    actions: [...ALL_ACTIONS],
    adapters: [
      'home_assistant',
      'navigation',
      'weather',
      'apple_notes',
      'apple_reminders',
      'mcp_client',
    ],
    description: 'Personal assistant agent',
  },
  default: {
    label: 'Default',
    tier: 4,
    actions: [...ALL_ACTIONS],
    description: 'Default template — all actions',
    adapters: ['ciris_hosted_tools'],
  },

  // ========================================================================
  // Licensed Templates — require module package download
  // ========================================================================
  iris: {
    label: 'Iris (Medical)',
    tier: 5,
    actions: [
      'SPEAK',
      'OBSERVE',
      'MEMORIZE',
      'RECALL',
      'DEFER',
      'PONDER',
      'TOOL',
      'TASK_COMPLETE',
      'REJECT',
    ],
    adapters: [
      'cirisnode',
      'ciris_accord_metrics',
      'ciris_verify',
      'medical_llm',
      'openemr',
      'hl7',
      'fhir',
    ],
    description:
      'Medical support agent — clinical data integration, HL7/FHIR, EHR (Tier 5, licensed)',
    licensed: true,
    packageId: 'medical',
  },
  aureus: {
    label: 'Aureus (Financial)',
    tier: 5,
    actions: [
      'SPEAK',
      'OBSERVE',
      'MEMORIZE',
      'RECALL',
      'DEFER',
      'PONDER',
      'TOOL',
      'TASK_COMPLETE',
      'REJECT',
    ],
    adapters: [
      'cirisnode',
      'ciris_accord_metrics',
      'ciris_verify',
      'financial_llm',
      'fix_gateway',
      'swift_adapter',
      'xbrl_adapter',
    ],
    description:
      'Financial support agent — portfolio data, regulatory reporting, compliance (Tier 5, licensed)',
    licensed: true,
    packageId: 'financial',
  },
  themis: {
    label: 'Themis (Legal)',
    tier: 5,
    actions: [
      'SPEAK',
      'OBSERVE',
      'MEMORIZE',
      'RECALL',
      'DEFER',
      'PONDER',
      'TOOL',
      'TASK_COMPLETE',
      'REJECT',
    ],
    adapters: [
      'cirisnode',
      'ciris_accord_metrics',
      'ciris_verify',
      'legal_llm',
      'ecf_adapter',
      'case_management',
      'privilege_tracker',
    ],
    description:
      'Legal support agent — case research, document analysis, privilege management (Tier 5, licensed)',
    licensed: true,
    packageId: 'legal',
  },
};

export interface KnownAdapter {
  name: string;
  category: string;
}

// Known adapters from CIRISAgent/ciris_adapters/
export const KNOWN_ADAPTERS: KnownAdapter[] = [
  // Core / Platform
  { name: 'ciris_hosted_tools', category: 'Core' },
  { name: 'ciris_accord_metrics', category: 'Core' },
  { name: 'ciris_verify', category: 'Core' },
  { name: 'cirisnode', category: 'Core' },
  { name: 'session_logs', category: 'Core' },
  { name: 'model_usage', category: 'Core' },
  // Communication
  { name: 'a2a', category: 'Communication' },
  { name: 'bluebubbles', category: 'Communication' },
  { name: 'blucli', category: 'Communication' },
  { name: 'himalaya', category: 'Communication' },
  { name: 'imsg', category: 'Communication' },
  { name: 'reddit', category: 'Communication' },
  { name: 'slack', category: 'Communication' },
  { name: 'voice_call', category: 'Communication' },
  // Productivity
  { name: 'apple_notes', category: 'Productivity' },
  { name: 'apple_reminders', category: 'Productivity' },
  { name: 'bear_notes', category: 'Productivity' },
  { name: 'github', category: 'Productivity' },
  { name: 'notion', category: 'Productivity' },
  { name: 'obsidian', category: 'Productivity' },
  { name: 'things_mac', category: 'Productivity' },
  { name: 'trello', category: 'Productivity' },
  // Smart Home / IoT
  { name: 'home_assistant', category: 'Smart Home' },
  { name: 'openhue', category: 'Smart Home' },
  { name: 'sonoscli', category: 'Smart Home' },
  { name: 'eightctl', category: 'Smart Home' },
  // Media
  { name: 'camsnap', category: 'Media' },
  { name: 'gifgrep', category: 'Media' },
  { name: 'nano_banana_pro', category: 'Media' },
  { name: 'nano_pdf', category: 'Media' },
  { name: 'openai_image_gen', category: 'Media' },
  { name: 'openai_whisper', category: 'Media' },
  { name: 'openai_whisper_api', category: 'Media' },
  { name: 'peekaboo', category: 'Media' },
  { name: 'sherpa_onnx_tts', category: 'Media' },
  { name: 'songsee', category: 'Media' },
  { name: 'spotify_player', category: 'Media' },
  { name: 'video_frames', category: 'Media' },
  // Navigation / Location
  { name: 'navigation', category: 'Location' },
  { name: 'goplaces', category: 'Location' },
  { name: 'local_places', category: 'Location' },
  { name: 'weather', category: 'Location' },
  // Data / Integration
  { name: 'external_data_sql', category: 'Data' },
  { name: 'mcp_client', category: 'Data' },
  { name: 'mcp_server', category: 'Data' },
  { name: 'mcp_common', category: 'Data' },
  { name: 'mcporter', category: 'Data' },
  { name: 'oracle', category: 'Data' },
  // Developer
  { name: 'coding_agent', category: 'Developer' },
  { name: 'tmux', category: 'Developer' },
  { name: 'skill_creator', category: 'Developer' },
  { name: 'wacli', category: 'Developer' },
  // AI / LLM
  { name: 'gemini', category: 'AI' },
  { name: 'clawdhub', category: 'AI' },
  { name: 'summarize', category: 'AI' },
  // Licensed — Medical
  { name: 'medical_llm', category: 'Licensed' },
  { name: 'openemr', category: 'Licensed' },
  { name: 'hl7', category: 'Licensed' },
  { name: 'fhir', category: 'Licensed' },
  // Licensed — Financial
  { name: 'financial_llm', category: 'Licensed' },
  { name: 'fix_gateway', category: 'Licensed' },
  { name: 'swift_adapter', category: 'Licensed' },
  { name: 'xbrl_adapter', category: 'Licensed' },
  // Licensed — Legal
  { name: 'legal_llm', category: 'Licensed' },
  { name: 'ecf_adapter', category: 'Licensed' },
  { name: 'case_management', category: 'Licensed' },
  { name: 'privilege_tracker', category: 'Licensed' },
  // Other
  { name: 'blogwatcher', category: 'Other' },
  { name: 'bird', category: 'Other' },
  { name: 'gog', category: 'Other' },
  { name: 'onepassword', category: 'Other' },
  { name: 'ordercli', category: 'Other' },
  { name: 'sag', category: 'Other' },
  { name: 'sample_adapter', category: 'Other' },
  { name: 'mock_llm', category: 'Other' },
];
