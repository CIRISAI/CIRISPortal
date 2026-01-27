import { Providers } from '../providers';

export const metadata = {
  title: 'CIRIS Registry Status',
  description: 'Real-time system health and status information',
};

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
