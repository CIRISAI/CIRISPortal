/**
 * Licensed package registry.
 *
 * Defines the available licensed module packages (medical, financial, legal)
 * and provides metadata for the package download API. Packages are zipped
 * from their source directories and served to agents during the device auth
 * provisioning flow.
 *
 * Each package contains:
 * - templates/*.yaml — Identity template for the domain
 * - modules/ — CIRISAgent modules (enabler, LLM adapter, triage WA, etc.)
 * - config/ — Deployment config and license template
 * - compliance/ — License verification code
 */

export interface LicensedPackage {
  id: string;
  name: string;
  domain: string;
  description: string;
  templateId: string; // Corresponding TEMPLATE_PRESETS key
  tier: number;
  version: string;
  requiredEnvVars: string[];
  requiredLicense: string;
  regulatoryCompliance: string[];
  sourcePath: string; // Absolute path to package source directory
  warning: string;
}

/**
 * Registry of available licensed module packages.
 *
 * In production, sourcePath points to where packages are stored on the
 * Portal deployment host (e.g., /opt/ciris/packages/). For development,
 * they point to the local repo directories.
 */
export const LICENSED_PACKAGES: Record<string, LicensedPackage> = {
  medical: {
    id: 'medical',
    name: 'CIRISMedical',
    domain: 'medical',
    description:
      'Medical AI support agent (Iris) — clinical data integration, HL7/FHIR, EHR support',
    templateId: 'iris',
    tier: 5,
    version: '1.0.0',
    requiredEnvVars: [
      'MEDICAL_LICENSE_FILE',
      'MEDICAL_SUPERVISOR_ID',
      'I_ACCEPT_MEDICAL_LIABILITY',
    ],
    requiredLicense: 'CIRIS Medical License (CML) v1.0',
    regulatoryCompliance: ['PMDC', 'WHO', 'HIPAA', 'GDPR', 'FDA', 'EU AI Act'],
    sourcePath:
      process.env.PACKAGE_PATH_MEDICAL || '/Users/macmini/CIRISMedical',
    warning:
      'MEDICAL SOFTWARE — Requires licensed medical facility, medical professional supervision, and malpractice insurance.',
  },
  financial: {
    id: 'financial',
    name: 'CIRISFinancial',
    domain: 'financial',
    description:
      'Financial AI support agent (Aureus) — portfolio data integration, regulatory reporting, compliance support',
    templateId: 'aureus',
    tier: 5,
    version: '1.0.0',
    requiredEnvVars: [
      'FINANCIAL_LICENSE_FILE',
      'FINANCIAL_SUPERVISOR_ID',
      'I_ACCEPT_FINANCIAL_LIABILITY',
    ],
    requiredLicense: 'CIRIS Financial License (CFL) v1.0',
    regulatoryCompliance: [
      'SEC',
      'FINRA',
      'SOX',
      'PCI-DSS',
      'GDPR',
      'MiFID II',
    ],
    sourcePath:
      process.env.PACKAGE_PATH_FINANCIAL || '/Users/macmini/CIRISFinancial',
    warning:
      'FINANCIAL SOFTWARE — Requires licensed financial institution, qualified financial professional supervision, and E&O insurance.',
  },
  legal: {
    id: 'legal',
    name: 'CIRISLegal',
    domain: 'legal',
    description:
      'Legal AI support agent (Themis) — case research, document analysis, privilege management',
    templateId: 'themis',
    tier: 5,
    version: '1.0.0',
    requiredEnvVars: [
      'LEGAL_LICENSE_FILE',
      'LEGAL_SUPERVISOR_ID',
      'I_ACCEPT_LEGAL_LIABILITY',
    ],
    requiredLicense: 'CIRIS Legal License (CLL) v1.0',
    regulatoryCompliance: [
      'ABA Model Rules',
      'State Bar Requirements',
      'GDPR',
      'EU AI Act',
    ],
    sourcePath: process.env.PACKAGE_PATH_LEGAL || '/Users/macmini/CIRISLegal',
    warning:
      'LEGAL SOFTWARE — Requires licensed law firm or legal department, supervising attorney, and malpractice insurance.',
  },
};

/**
 * Get package metadata by ID (without source path — safe for API responses).
 */
export function getPackageInfo(packageId: string) {
  const pkg = LICENSED_PACKAGES[packageId];
  if (!pkg) return null;

  // Strip sourcePath from public response
  const { sourcePath, ...publicInfo } = pkg;
  return publicInfo;
}

/**
 * List all available packages (public metadata only).
 */
export function listPackages() {
  return Object.values(LICENSED_PACKAGES).map((pkg) => {
    const { sourcePath, ...publicInfo } = pkg;
    return publicInfo;
  });
}

/**
 * Check if a template requires a licensed package.
 */
export function isLicensedTemplate(templateId: string): boolean {
  return Object.values(LICENSED_PACKAGES).some(
    (pkg) => pkg.templateId === templateId
  );
}

/**
 * Get the package ID for a licensed template.
 */
export function getPackageForTemplate(templateId: string): string | null {
  const entry = Object.entries(LICENSED_PACKAGES).find(
    ([, pkg]) => pkg.templateId === templateId
  );
  return entry ? entry[0] : null;
}
