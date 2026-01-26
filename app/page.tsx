import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Banner */}
      <div className="bg-blue-600 px-4 py-3 text-center text-white">
        <p className="text-sm font-medium">
          Sample Dashboard - Full Release December 2025
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="max-w-4xl">
          {/* Hero Section */}
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-6xl font-bold text-gray-900">
              <span className="text-blue-600">Sage</span>
            </h1>
            <p className="mb-6 text-2xl font-semibold text-gray-700">
              Democratizing Privacy Compliance
            </p>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-gray-600">
              Managing GDPR compliance shouldn&apos;t require an army of lawyers
              and engineers. Sage makes data subject rights accessible to
              organizations of all sizes through intelligent automation and
              ethical AI.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="mb-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 text-3xl">🔍</div>
              <h3 className="mb-2 font-semibold text-gray-900">
                Multi-Source Discovery
              </h3>
              <p className="text-sm text-gray-600">
                Automatically find user data across all your databases and
                services using privacy schemas
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 text-3xl">⚡</div>
              <h3 className="mb-2 font-semibold text-gray-900">
                Instant DSARs
              </h3>
              <p className="text-sm text-gray-600">
                Fulfill access, deletion, and portability requests in minutes,
                not weeks
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 text-3xl">🔐</div>
              <h3 className="mb-2 font-semibold text-gray-900">
                Cryptographic Proof
              </h3>
              <p className="text-sm text-gray-600">
                Ed25519 signatures verify every deletion with auditable
                compliance trails
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mb-8 text-center">
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
            >
              View Sample Dashboard
            </Link>
          </div>

          {/* Why Sage Section */}
          <div className="mb-12 rounded-lg bg-blue-50 p-8">
            <h2 className="mb-4 text-center text-2xl font-bold text-gray-900">
              Why Sage?
            </h2>
            <div className="space-y-3 text-gray-700">
              <p>
                <strong className="text-blue-600">Built on CIRIS Agent:</strong>{' '}
                Ethical AI framework ensuring transparent, auditable privacy
                operations
              </p>
              <p>
                <strong className="text-blue-600">Privacy-First:</strong> Your
                privacy schemas define what data matters—Sage never sees more
                than necessary
              </p>
              <p>
                <strong className="text-blue-600">Open Architecture:</strong>{' '}
                AGPL v3 license with commercial options for proprietary
                deployments
              </p>
            </div>
          </div>

          {/* Links Section */}
          <div className="flex flex-col items-center gap-4 text-center">
            <a
              href="https://ciris.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              🌐 Visit CIRIS.ai
            </a>
            <a
              href="https://github.com/CIRISAI/CIRISAgent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              🔗 View CIRISAgent on GitHub
            </a>
            <a
              href="https://scout.ciris.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              💬 Chat with scout.ciris.ai about the open source CIRIS Agent
              framework
            </a>
            <a
              href="mailto:sales@ciris.ai"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              📧 Contact CIRIS L3C about ethical AI consulting or piloting Sage
              at sales@ciris.ai
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
