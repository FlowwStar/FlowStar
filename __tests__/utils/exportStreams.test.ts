import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV, exportToJSON, copyToClipboard, type Stream } from '@/utils/exportStreams';

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('utils/exportStreams', () => {
  const mockBlobUrl = 'blob:http://localhost/mock-export-url';

  const mockStreams: Stream[] = [
    {
      id: 'stream-1',
      token: 'USDC',
      sender: 'GSENDER111',
      recipient: 'GRECIPIENT222',
      totalAmount: 100_000_000, // 10 USDC (10 * 10^7 stroops)
      withdrawn: 25_000_000,   // 2.5 USDC
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.000Z',
      createdAt: '2025-12-15T12:00:00.000Z',
      cliff: '2026-02-01T00:00:00.000Z',
      rate: 100,
      txHistory: [{ txHash: '0x123' }],
    },
    {
      id: 'stream-2',
      token: 'XLM',
      sender: 'GSENDER333',
      recipient: 'GRECIPIENT444',
      totalAmount: 50_000_000, // 5 XLM
      withdrawn: 0,
      status: 'completed',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
      createdAt: '2026-01-20T08:30:00.000Z',
    },
  ];

  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue(mockBlobUrl);
    revokeObjectURLMock = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('exportToCSV', () => {
    it('creates a CSV blob with correct headers and formatted data rows, and triggers file download', async () => {
      let createdBlob: Blob | null = null;
      createObjectURLMock.mockImplementation((blob: Blob) => {
        createdBlob = blob;
        return mockBlobUrl;
      });

      exportToCSV(mockStreams, 'custom-streams.csv');

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(createdBlob).not.toBeNull();
      expect(createdBlob!.type).toBe('text/csv');

      const text = await readBlobAsText(createdBlob!);
      const lines = text.split('\n');

      expect(lines[0]).toBe('Stream ID,Token,Sender,Recipient,Total Amount,Withdrawn,Status,Start Date,End Date,Created At');

      expect(lines[1]).toBe(
        [
          'stream-1',
          'USDC',
          'GSENDER111',
          'GRECIPIENT222',
          '10.0000000',
          '2.5000000',
          'active',
          new Date('2026-01-01T00:00:00.000Z').toISOString(),
          new Date('2026-12-31T23:59:59.000Z').toISOString(),
          new Date('2025-12-15T12:00:00.000Z').toISOString(),
        ].join(',')
      );

      expect(lines[2]).toBe(
        [
          'stream-2',
          'XLM',
          'GSENDER333',
          'GRECIPIENT444',
          '5.0000000',
          '0.0000000',
          'completed',
          new Date('2026-02-01T00:00:00.000Z').toISOString(),
          new Date('2026-03-01T00:00:00.000Z').toISOString(),
          new Date('2026-01-20T08:30:00.000Z').toISOString(),
        ].join(',')
      );

      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith(mockBlobUrl);
    });

    it('generates a default filename with current ISO date when no filename is provided', () => {
      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const elem = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          capturedAnchor = elem as HTMLAnchorElement;
        }
        return elem;
      });

      const today = new Date().toISOString().slice(0, 10);
      exportToCSV(mockStreams);

      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor!.download).toBe(`flowstar-streams-${today}.csv`);
    });

    it('exports only header when given an empty streams array', async () => {
      let createdBlob: Blob | null = null;
      createObjectURLMock.mockImplementation((blob: Blob) => {
        createdBlob = blob;
        return mockBlobUrl;
      });

      exportToCSV([]);

      const text = await readBlobAsText(createdBlob!);
      const lines = text.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('Stream ID,Token,Sender,Recipient,Total Amount,Withdrawn,Status,Start Date,End Date,Created At');
    });
  });

  describe('exportToJSON', () => {
    it('creates a JSON blob with formatted stream properties and triggers download', async () => {
      let createdBlob: Blob | null = null;
      createObjectURLMock.mockImplementation((blob: Blob) => {
        createdBlob = blob;
        return mockBlobUrl;
      });

      exportToJSON(mockStreams, 'custom-streams.json');

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(createdBlob).not.toBeNull();
      expect(createdBlob!.type).toBe('application/json');

      const text = await readBlobAsText(createdBlob!);
      const parsed = JSON.parse(text);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        ...mockStreams[0],
        totalAmountFormatted: '10.0000000',
        withdrawnFormatted: '2.5000000',
        startDate: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        endDate: new Date('2026-12-31T23:59:59.000Z').toISOString(),
        createdAt: new Date('2025-12-15T12:00:00.000Z').toISOString(),
      });

      expect(parsed[1]).toEqual({
        ...mockStreams[1],
        totalAmountFormatted: '5.0000000',
        withdrawnFormatted: '0.0000000',
        startDate: new Date('2026-02-01T00:00:00.000Z').toISOString(),
        endDate: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        createdAt: new Date('2026-01-20T08:30:00.000Z').toISOString(),
      });

      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith(mockBlobUrl);
    });

    it('generates a default JSON filename when filename parameter is omitted', () => {
      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const elem = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          capturedAnchor = elem as HTMLAnchorElement;
        }
        return elem;
      });

      const today = new Date().toISOString().slice(0, 10);
      exportToJSON(mockStreams);

      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor!.download).toBe(`flowstar-streams-${today}.json`);
    });

    it('handles empty streams array for exportToJSON', async () => {
      let createdBlob: Blob | null = null;
      createObjectURLMock.mockImplementation((blob: Blob) => {
        createdBlob = blob;
        return mockBlobUrl;
      });

      exportToJSON([]);

      const text = await readBlobAsText(createdBlob!);
      expect(JSON.parse(text)).toEqual([]);
    });
  });

  describe('copyToClipboard', () => {
    it('copies pretty-printed JSON streams to navigator.clipboard', () => {
      copyToClipboard(mockStreams);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const expectedJson = JSON.stringify(mockStreams, null, 2);
      expect(writeTextMock).toHaveBeenCalledWith(expectedJson);
    });

    it('copies empty array when passed an empty streams array', () => {
      copyToClipboard([]);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(writeTextMock).toHaveBeenCalledWith('[]');
    });
  });
});
