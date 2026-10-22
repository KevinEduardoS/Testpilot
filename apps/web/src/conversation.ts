import {
  MAX_PREVIOUS_INSTRUCTIONS,
  type ConversationContext,
  type GeneratedTest,
} from '@testpilot/shared';
import type { GenerateResult } from './api';

export type TurnReply =
  | { phase: 'loading'; startedAt: number }
  // version es el número de versión de la prueba si la respuesta generó una.
  | { phase: 'done'; result: GenerateResult; version: number | null };

export type Turn = { id: number; instruction: string; reply: TurnReply };

export type Version = { number: number; test: GeneratedTest };

export const versionsOf = (turns: Turn[]): Version[] =>
  turns.flatMap(({ reply }) =>
    reply.phase === 'done' &&
    reply.version !== null &&
    reply.result.ok &&
    reply.result.data.status === 'ok'
      ? [{ number: reply.version, test: reply.result.data.test }]
      : [],
  );

export const nextVersionNumber = (turns: Turn[]): number =>
  versionsOf(turns).reduce((max, version) => Math.max(max, version.number), 0) + 1;

// Al pedir un cambio, el modelo parte de la versión que el usuario está viendo y recibe las
// instrucciones anteriores más recientes como historial.
export const buildContext = (
  turns: Turn[],
  base: Version | undefined,
): ConversationContext | undefined =>
  base === undefined
    ? undefined
    : {
        previousInstructions: turns
          .map((turn) => turn.instruction)
          .slice(-MAX_PREVIOUS_INSTRUCTIONS),
        currentScript: base.test.script,
      };
