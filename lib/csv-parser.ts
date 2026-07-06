'use client'

export interface CsvBatchRow {
  recipient: string
  amount: string
  start_time: string
  end_time: string
  cliff_time?: string
  cliff_amount?: string
  cliff_duration?: string
  start_date?: string
  end_date?: string
}

export interface CsvParseResult {
  rows: CsvBatchRow[]
  errors: string[]
  headerMapping?: Record<string, number>
}

// Flexible header mapping - supports multiple naming conventions
const HEADER_ALIASES = {
  recipient: ['recipient', 'recipient_address', 'address', 'to'],
  amount: ['amount', 'total_amount', 'stream_amount'],
  start_time: ['start_time', 'start_date', 'start_timestamp'],
  end_time: ['end_time', 'end_date', 'end_timestamp'],
  cliff_time: ['cliff_time', 'cliff_date', 'cliff_timestamp'],
  cliff_amount: ['cliff_amount'],
  cliff_duration: ['cliff_duration', 'cliff_period'],
  start_date: ['start_date', 'start_time'],
  end_date: ['end_date', 'end_time'],
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      const nextChar = line[i + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

function findColumnIndex(headers: string[], fieldName: string): number {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  const aliases = HEADER_ALIASES[fieldName as keyof typeof HEADER_ALIASES] || []

  for (const alias of aliases) {
    const index = normalized.indexOf(alias)
    if (index !== -1) return index
  }

  return -1
}

export function parseCsvBatch(
  csvText: string,
  customColumnMapping?: Record<string, number>,
): CsvParseResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const errors: string[] = []
  const rows: CsvBatchRow[] = []

  if (lines.length === 0) {
    return { rows, errors }
  }

  let startIndex = 0
  let headerMapping: Record<string, number> = customColumnMapping ?? {}

  const firstRow = parseCsvLine(lines[0])
  const firstRowLower = firstRow.map((v) => v.toLowerCase())

  // Check if first row looks like a header
  const isLikelyHeader = firstRowLower.some((v) =>
    Object.values(HEADER_ALIASES).some((aliases) =>
      aliases.some((alias) => v === alias),
    ),
  )

  if (isLikelyHeader && !customColumnMapping) {
    startIndex = 1

    // Auto-detect column mapping
    headerMapping = {
      recipient: findColumnIndex(firstRow, 'recipient'),
      amount: findColumnIndex(firstRow, 'amount'),
      start_time: findColumnIndex(firstRow, 'start_time'),
      end_time: findColumnIndex(firstRow, 'end_time'),
      cliff_time: findColumnIndex(firstRow, 'cliff_time'),
      cliff_amount: findColumnIndex(firstRow, 'cliff_amount'),
      cliff_duration: findColumnIndex(firstRow, 'cliff_duration'),
      start_date: findColumnIndex(firstRow, 'start_date'),
      end_date: findColumnIndex(firstRow, 'end_date'),
    }

    // Validate required columns exist
    if (
      headerMapping.recipient === -1
      || headerMapping.amount === -1
      || (headerMapping.start_time === -1 && headerMapping.start_date === -1)
      || (headerMapping.end_time === -1 && headerMapping.end_date === -1)
    ) {
      errors.push(
        'CSV must have columns for recipient, amount, and start/end times (start_time/start_date and end_time/end_date)',
      )
      return { rows, errors, headerMapping }
    }
  }

  // Parse data rows
  for (let index = startIndex; index < lines.length; index += 1) {
    const rowNumber = index + 1
    const values = parseCsvLine(lines[index])

    const row: CsvBatchRow = {
      recipient: values[headerMapping.recipient ?? 0] ?? '',
      amount: values[headerMapping.amount ?? 1] ?? '',
      start_time: values[headerMapping.start_time ?? 2] ?? '',
      end_time: values[headerMapping.end_time ?? 3] ?? '',
    }

    // Add optional fields if mapped
    if (headerMapping.cliff_time !== undefined && headerMapping.cliff_time !== -1) {
      row.cliff_time = values[headerMapping.cliff_time]
    }
    if (headerMapping.cliff_amount !== undefined && headerMapping.cliff_amount !== -1) {
      row.cliff_amount = values[headerMapping.cliff_amount]
    }
    if (headerMapping.cliff_duration !== undefined && headerMapping.cliff_duration !== -1) {
      row.cliff_duration = values[headerMapping.cliff_duration]
    }
    if (headerMapping.start_date !== undefined && headerMapping.start_date !== -1) {
      row.start_date = values[headerMapping.start_date]
    }
    if (headerMapping.end_date !== undefined && headerMapping.end_date !== -1) {
      row.end_date = values[headerMapping.end_date]
    }

    rows.push(row)
  }

  return { rows, errors, headerMapping }
}
