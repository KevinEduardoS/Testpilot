import {
  MAX_PREVIOUS_INSTRUCTIONS,
  type ConversationContext,
  type GeneratedTest,
} from '@testpilot/shared';
import type { GenerateResult, RepairResult } from './api';

type Reply<Result> =
  | { phase: 'loading'; startedAt: number }
  // version es el número de versión de la prueba si la respuesta generó una.
  | { phase: 'done'; result: Result; version: number | null };

export type InstructionReply = Reply<GenerateResult>;
export type RepairReply = Reply<RepairResult>;

export type Turn =
  | { id: number; kind: 'instruction'; instruction: string; reply: InstructionReply }
  // Diagnóstico y reparación de una versión que falló al ejecutarse.
  | { id: number; kind: 'repair'; sourceVersion: number; reply: RepairReply };

export type Version = {
  number: number;
  test: GeneratedTest;
  // Versión de la que es reparación, o null si salió de una instrucción.
  repairedFrom: number | null;
};

const versionOf = (turn: Turn): Version[] => {
  const { reply } = turn;
  if (reply.phase !== 'done' || reply.version === null || !reply.result.ok) {
    return [];
  }
  const { data } = reply.result;
  if (data.status === 'ok') {
    return [{ number: reply.version, test: data.test, repairedFrom: null }];
  }
  if (data.status === 'fixed' && turn.kind === 'repair') {
    return [{ number: reply.version, test: data.test, repairedFrom: turn.sourceVersion }];
  }
  return [];
};

export const versionsOf = (turns: Turn[]): Version[] => turns.flatMap(versionOf);

export const nextVersionNumber = (turns: Turn[]): number =>
  versionsOf(turns).reduce((max, version) => Math.max(max, version.number), 0) + 1;

const instructionsOf = (turns: Turn[]): string[] =>
  turns
    .flatMap((turn) => (turn.kind === 'instruction' ? [turn.instruction] : []))
    .slice(-MAX_PREVIOUS_INSTRUCTIONS);

// Al pedir un cambio, el modelo parte de la versión que el usuario está viendo y recibe las
// instrucciones anteriores más recientes como historial.
export const buildContext = (
  turns: Turn[],
  base: Version | undefined,
): ConversationContext | undefined =>
  base === undefined
    ? undefined
    : { previousInstructions: instructionsOf(turns), currentScript: base.test.script };

// Lo que el usuario había pedido hasta crear esa versión: la intención que la reparación respeta.
export const instructionsForVersion = (turns: Turn[], versionNumber: number): string[] => {
  const end = turns.findIndex(
    ({ reply }) => reply.phase === 'done' && reply.version === versionNumber,
  );
  return instructionsOf(turns.slice(0, end + 1));
};
