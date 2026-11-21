import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Batch create streams',
  description:
    'Upload a CSV to create many token streams at once on Stellar.',
};

export default function BatchCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}