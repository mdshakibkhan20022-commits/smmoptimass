import { PublicLayout } from '@/components/PublicLayout';
import { ServicesTable } from '@/components/ServicesTable';
import { ApiDocs } from '@/components/ApiDocs';
import { useApp } from '@/context/AppContext';

function PublicPage({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </PublicLayout>
  );
}

export function PublicServicesPage() {
  const { currency, setCurrency } = useApp();
  return (
    <PublicPage title="Services & Prices" subtitle="All prices are per 1000 units.">
      <div className="mb-4 flex justify-end">
        <select className="input w-auto" value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'BDT')}>
          <option value="USD">USD ($)</option>
          <option value="BDT">BDT (৳)</option>
        </select>
      </div>
      <ServicesTable />
    </PublicPage>
  );
}

export function PublicApiPage() {
  return (
    <PublicPage title="API Documentation" subtitle="Connect your panel or app to SMM OPTIMA. Sign in to see your API key.">
      <ApiDocs />
    </PublicPage>
  );
}

const LEGAL: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['General', 'By placing an order with SMM OPTIMA you automatically accept these terms. We reserve the right to change them without notice.'],
      ['Service', 'We only need public links. Your account or post must remain public until the order completes. We do not guarantee that delivered engagement will interact with your content.'],
      ['Orders', 'Do not place multiple orders for the same link at the same time. Orders placed on private, deleted or invalid links may be marked as completed without refund.'],
      ['Refill', 'Refills are only available on services marked with refill and within the stated refill period.'],
      ['Account', 'Accounts used for fraud, chargebacks or abuse will be suspended without refund.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Information we collect', 'We collect your username, email, and the order links you provide so we can deliver our services.'],
      ['How we use it', 'Your information is used to process orders, payments and support requests. We never sell your data.'],
      ['Security', 'Passwords are encrypted and payments are verified. We never ask for your social media passwords.'],
      ['Contact', 'For any privacy question please open a support ticket.'],
    ],
  },
  'refund-policy': {
    title: 'Refund Policy',
    sections: [
      ['Balance refunds', 'Canceled orders are refunded to your panel balance automatically. Partial orders are refunded for the undelivered amount.'],
      ['Deposits', 'Deposits to your balance are non-refundable to your payment method once used for orders.'],
      ['Disputes', 'Filing a chargeback or dispute will result in the immediate suspension of your account.'],
    ],
  },
};

export function LegalPage({ page }: { page: keyof typeof LEGAL }) {
  const { settings } = useApp();
  const doc = LEGAL[page];
  return (
    <PublicPage title={doc.title}>
      <div className="card max-w-3xl space-y-6 p-6 sm:p-8">
        {doc.sections.map(([h, t]) => (
          <div key={h}>
            <h2 className="font-bold">{h}</h2>
            <p className="mt-1.5 text-sm text-muted">{t}</p>
          </div>
        ))}
        {settings?.support_email && <p className="text-sm text-muted">Contact: {settings.support_email}</p>}
      </div>
    </PublicPage>
  );
}
