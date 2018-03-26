import {IUserTaskEntity} from '@process-engine/process_engine_contracts';

export class CorrelationCache {
  [correlationId: string]: string;
}

export enum MessageAction {
  event = 'event',
  abort = 'abort',
  proceed = 'proceed',
}
