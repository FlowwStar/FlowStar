export interface Stream {
  id:          string;
  token:       string;
  sender:      string;
  recipient:   string;
  totalAmount: number;  // in stroops
  withdrawn:   number;  // in stroops
  status:      string;
  startDate:   string;
  endDate:     string;
  createdAt:   string;
  cliff?:      string;
  rate?:       number;
  txHistory?:  unknown[];
}

const STROOP = 10_000_000;

function formatAmount(stroops: number): string {
  return (stroops / STROOP).toFixed(7);
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(streams: Stream[], filename?: string) {
  const headers = [
    'Stream ID','Token','Sender','Recipient',
    'Total Amount','Withdrawn','Status',
    'Start Date','End Date','Created At',
  ];
  const rows = streams.map(s => [
    s.id, s.token, s.sender, s.recipient,
    formatAmount(s.totalAmount), formatAmount(s.withdrawn),
    s.status,
    new Date(s.startDate).toISOString(),
    new Date(s.endDate).toISOString(),
    new Date(s.createdAt).toISOString(),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const name = filename ?? `flowstar-streams-${new Date().toISOString().slice(0,10)}.csv`;
  downloadFile(csv, name, 'text/csv');
}

export function exportToJSON(streams: Stream[], filename?: string) {
  const data = streams.map(s => ({
    ...s,
    totalAmountFormatted: formatAmount(s.totalAmount),
    withdrawnFormatted:   formatAmount(s.withdrawn),
    startDate:  new Date(s.startDate).toISOString(),
    endDate:    new Date(s.endDate).toISOString(),
    createdAt:  new Date(s.createdAt).toISOString(),
  }));
  const name = filename ?? `flowstar-streams-${new Date().toISOString().slice(0,10)}.json`;
  downloadFile(JSON.stringify(data, null, 2), name, 'application/json');
}

export function copyToClipboard(streams: Stream[]) {
  const json = JSON.stringify(streams, null, 2);
  navigator.clipboard.writeText(json);
}