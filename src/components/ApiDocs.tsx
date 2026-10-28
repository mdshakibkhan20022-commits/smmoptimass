import { functionsUrl } from '@/lib/supabase';

const ACTIONS = [
  {
    title: 'Service list',
    params: [['key', 'Your API key'], ['action', 'services']],
    example: `[\n  {\n    "service": 1,\n    "name": "Instagram Followers",\n    "type": "Default",\n    "category": "Instagram Followers",\n    "rate": "0.9000",\n    "min": "50",\n    "max": "10000",\n    "refill": true,\n    "cancel": false\n  }\n]`,
  },
  {
    title: 'Add order',
    params: [['key', 'Your API key'], ['action', 'add'], ['service', 'Service ID'], ['link', 'Link to page'], ['quantity', 'Needed quantity']],
    example: `{\n  "order": 23501\n}`,
  },
  {
    title: 'Order status',
    params: [['key', 'Your API key'], ['action', 'status'], ['order', 'Order ID (or "orders" with up to 100 IDs, comma separated)']],
    example: `{\n  "charge": "0.2782",\n  "start_count": "3572",\n  "status": "Partial",\n  "remains": "157",\n  "currency": "USD"\n}`,
  },
  {
    title: 'Create refill',
    params: [['key', 'Your API key'], ['action', 'refill'], ['order', 'Order ID']],
    example: `{\n  "refill": "1"\n}`,
  },
  {
    title: 'User balance',
    params: [['key', 'Your API key'], ['action', 'balance']],
    example: `{\n  "balance": "100.8429",\n  "currency": "USD"\n}`,
  },
];

export function ApiDocs({ apiKey }: { apiKey?: string }) {
  return (
    <div className="space-y-5">
      <div className="card grid gap-4 p-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="label">API URL</p>
          <code className="block break-all rounded-lg bg-soft px-3 py-2 text-sm">{functionsUrl}/api</code>
        </div>
        <div>
          <p className="label">HTTP method</p>
          <code className="block rounded-lg bg-soft px-3 py-2 text-sm">POST</code>
        </div>
        {apiKey && (
          <div className="sm:col-span-3">
            <p className="label">Your API key</p>
            <code className="block break-all rounded-lg bg-soft px-3 py-2 text-sm">{apiKey}</code>
          </div>
        )}
        <p className="text-sm text-muted sm:col-span-3">Response format: JSON. Parameters can be sent as form data or JSON.</p>
      </div>
      {ACTIONS.map((a) => (
        <div key={a.title} className="card overflow-hidden">
          <div className="border-b border-line bg-soft/60 px-5 py-3 font-bold">{a.title}</div>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 text-left text-xs font-semibold uppercase text-muted">Parameter</th>
                  <th className="py-2 text-left text-xs font-semibold uppercase text-muted">Description</th>
                </tr>
              </thead>
              <tbody>
                {a.params.map(([p, d]) => (
                  <tr key={p} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-4 font-mono font-semibold">{p}</td>
                    <td className="py-2 text-muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre className="overflow-x-auto rounded-xl bg-[#0d1512] p-4 text-xs text-brand-200">{a.example}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
