export type PtaxClosingQuote = {
  currency: string;
  date: string;
  buyRate: string;
  sellRate: string;
};

export class PtaxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PtaxApiError";
  }
}

const OLINDA_BASE =
  "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";

/** Format YYYY-MM-DD as MM-DD-YYYY for the Olinda OData parameters. */
export function toPtaxDateParam(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
}

export function buildCotacaoMoedaPeriodoUrl(
  currency: string,
  startDate: string,
  endDate: string,
): string {
  const moeda = encodeURIComponent(`'${currency.toUpperCase()}'`);
  const dataInicial = encodeURIComponent(`'${toPtaxDateParam(startDate)}'`);
  const dataFinal = encodeURIComponent(`'${toPtaxDateParam(endDate)}'`);
  return (
    `${OLINDA_BASE}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@moeda=${moeda}&@dataInicial=${dataInicial}&@dataFinalCotacao=${dataFinal}&$format=json`
  );
}

/**
 * Rewrite JSON number literals for PTAX rate fields to strings so we never
 * materialise a float for a stored rate.
 */
export function stringifyPtaxRateFields(raw: string): string {
  return raw.replace(
    /"(cotacaoCompra|cotacaoVenda)"\s*:\s*(-?\d+(?:\.\d+)?)/g,
    '"$1":"$2"',
  );
}

type RawPtaxRow = {
  cotacaoCompra?: string;
  cotacaoVenda?: string;
  dataHoraCotacao?: string;
  tipoBoletim?: string;
};

function isoDateFromDataHora(dataHoraCotacao: string): string | null {
  const match = dataHoraCotacao.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Keep only Fechamento (closing) quotes; one per calendar day.
 * Abertura/Intermediário rows are ignored. A day with no Fechamento yet
 * has no rate.
 */
export function parseCotacaoMoedaPeriodo(
  rawJson: string,
  currency: string,
): PtaxClosingQuote[] {
  const parsed = JSON.parse(stringifyPtaxRateFields(rawJson)) as {
    value?: RawPtaxRow[];
  };
  const rows = parsed.value ?? [];
  const byDate = new Map<string, PtaxClosingQuote>();

  for (const row of rows) {
    if (row.tipoBoletim !== "Fechamento") {
      continue;
    }
    if (
      typeof row.cotacaoCompra !== "string" ||
      typeof row.cotacaoVenda !== "string" ||
      typeof row.dataHoraCotacao !== "string"
    ) {
      continue;
    }
    const date = isoDateFromDataHora(row.dataHoraCotacao);
    if (!date) {
      continue;
    }
    byDate.set(date, {
      currency: currency.toUpperCase(),
      date,
      buyRate: row.cotacaoCompra,
      sellRate: row.cotacaoVenda,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchCotacaoMoedaPeriodo(
  currency: string,
  startDate: string,
  endDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PtaxClosingQuote[]> {
  const url = buildCotacaoMoedaPeriodoUrl(currency, startDate, endDate);
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PtaxApiError("ptax_fetch_failed", response.status);
  }
  return parseCotacaoMoedaPeriodo(text, currency);
}
