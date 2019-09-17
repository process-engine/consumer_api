import {Logger} from 'loggerhythm';
import {DataModels} from '@process-engine/consumer_api_contracts';

const logger = Logger.createLogger('processengine:consumer_api_core:paginator');

export function applyPagination<TValue>(values: Array<TValue>, offset: number, limit: number): Array<TValue> {

  if (offset > values.length) {
    logger.warn(`The offset of ${offset} is larger than the given value list (${values.length})! Returning an empty result set.`);
    return [];
  }

  let valueSubset = offset > 0
    ? values.slice(offset)
    : values;

  const limitIsOutOfValueListBounds = limit < 1 || limit >= valueSubset.length;
  if (limitIsOutOfValueListBounds) {
    return valueSubset;
  }

  valueSubset = valueSubset.slice(0, limit);

  return valueSubset;
}

export function applyPaginationForTaskList(
  taskList: DataModels.FlowNodeInstances.TaskList,
  offset: number,
  limit: number,
): DataModels.FlowNodeInstances.TaskList {

  const taskListLength = taskList.emptyActivities.length + taskList.manualTasks.length + taskList.userTasks.length;
  if (offset > taskListLength) {
    logger.warn(`The offset of ${offset} is larger than the given value list (${taskListLength})! Returning an empty result set.`);

    return {
      emptyActivities: [],
      manualTasks: [],
      userTasks: [],
      totalCount: 0,
    };
  }

  if (offset < 1 && limit < 1) {
    return taskList;
  }

  const offsetForEmptyActivities = offset;
  const limitForEmptyActivities = limit;

  const emptyActivities = applyPagination(taskList.emptyActivities, offsetForEmptyActivities, limitForEmptyActivities);

  const offsetForManualTasks = Math.max(offset - taskList.emptyActivities.length, 0);
  const limitForManualTasks = limit - emptyActivities.length;

  const manualTasks = limit > 0 && limitForManualTasks < 1 ? [] : applyPagination(taskList.manualTasks, offsetForManualTasks, limitForManualTasks);

  const offsetForUserTasks = Math.max(offset - taskList.emptyActivities.length - taskList.manualTasks.length, 0);
  const limitForUserTasks = limit - emptyActivities.length - manualTasks.length;

  const userTasks = limit > 0 && limitForUserTasks < 1 ? [] : applyPagination(taskList.userTasks, offsetForUserTasks, limitForUserTasks);

  const totalCount = emptyActivities.length + manualTasks.length + userTasks.length;

  const newTaskList = {
    emptyActivities: emptyActivities,
    manualTasks: manualTasks,
    userTasks: userTasks,
    totalCount: totalCount,
  };

  return newTaskList;
}
