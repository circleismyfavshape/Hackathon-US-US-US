// OWNER: D4. AI explanation of allocation trade-offs (P1).
//
// The model only puts the engine's numbers into words for a human coordinator. Every quantity
// comes from compareAllocations; the model is told not to add numbers, safety instructions or
// routes, and the response is labelled as AI-written.
import Anthropic from '@anthropic-ai/sdk';
import { STRATEGIES, type AiExplanation, type ComparisonResult, type RecoverySnapshot } from '../../../contracts/types.ts';
import { compareAllocations } from './index.ts';

export const EXPLAIN_MODEL = 'claude-opus-5-5';

/** The AI explanation could not be produced (no credentials, API error, refusal). */
export class AiUnavailableError extends Error {}

export type Explainer = (snapshot: RecoverySnapshot) => Promise<AiExplanation>;

/** Minimal shape of the SDK call we use, so tests can pass a fake client. */
export type MessagesClient = {
  beta: { messages: { create: (body: any, options?: any) => Promise<any> } };
};

const SYSTEM = `You help a human relief coordinator compare supply allocation plans for evacuation centres in a hackathon demo that uses simulated data.

You are given JSON: the centres' requests, the stock, and the result of each allocation strategy, all calculated by a deterministic engine. Explain the trade-offs between the strategies so the coordinator can choose.

Rules:
- Use only numbers that appear in the JSON. Do not calculate new allocations or invent quantities.
- Do not give safety instructions, evacuation routes or medical advice.
- Do not pick a plan for the coordinator. Say who gains and who loses under each strategy, and when each one fits.
- Plain text, no markdown, at most 150 words.`;

export function buildExplainInput(snapshot: RecoverySnapshot, results: ComparisonResult[]): string {
  return JSON.stringify({
    centres: snapshot.centres,
    inventory: snapshot.inventory,
    strategies: results.map((r) => ({
      strategy: r.strategy,
      allocations: r.allocations,
      totals: r.totals,
      inventoryRemaining: r.inventoryRemaining,
      rule: r.assumptions[0],
    })),
  });
}

export async function explainTradeoffs(snapshot: RecoverySnapshot, client?: MessagesClient): Promise<AiExplanation> {
  const results = STRATEGIES.map((s) => compareAllocations(structuredClone(snapshot), s));
  let response: any;
  try {
    // Credentials come from the environment (ANTHROPIC_API_KEY or an `ant auth login` profile).
    const api: MessagesClient = client ?? new Anthropic();
    response = await api.beta.messages.create(
      {
        model: EXPLAIN_MODEL,
        max_tokens: 8000,
        // If a safety classifier declines, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content: buildExplainInput(snapshot, results) }],
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiUnavailableError('AI explanation unavailable: the Anthropic credentials were rejected');
    if (e instanceof Anthropic.RateLimitError) throw new AiUnavailableError('AI explanation unavailable: rate limited, try again shortly');
    if (e instanceof Anthropic.APIError) throw new AiUnavailableError(`AI explanation unavailable: API error ${e.status ?? ''}`.trim());
    throw new AiUnavailableError('AI explanation unavailable: set ANTHROPIC_API_KEY on the server');
  }

  if (response.stop_reason === 'refusal') throw new AiUnavailableError('AI explanation unavailable: the model declined the request');
  const text = (response.content as { type: string; text?: string }[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
  if (!text) throw new AiUnavailableError('AI explanation unavailable: empty response');

  return {
    text,
    model: response.model ?? EXPLAIN_MODEL,
    source: 'ai',
    basedOn: [...STRATEGIES],
    disclaimer: 'AI-written summary of the engine\'s calculated numbers on simulated data. A human coordinator decides.',
    status: 'demo-only',
  };
}
