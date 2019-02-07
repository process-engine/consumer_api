import {Model} from '@process-engine/process_engine_contracts';

/**
 * Used to cache ProcessModels during UserTask conversion.
 * This helps to avoid repeated queries against the database for the same ProcessModel.
 */
type ProcessModelCache = {[processInstanceId: string]: Model.Types.Process};

const processModelCache: ProcessModelCache = {};

export function hasEntry(processInstanceId: string): boolean {
  return processModelCache[processInstanceId] !== undefined;
}

export function add(processInstanceId: string, processModel: Model.Types.Process): void {
  processModelCache[processInstanceId] = processModel;
}

export function get(processInstanceId: string): Model.Types.Process {
  return processModelCache[processInstanceId];
}
