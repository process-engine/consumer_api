import {BadRequestError} from '@essential-projects/errors_ts';

export function applyPagination<TValue>(values: Array<TValue>, offset: number, limit: number): Array<TValue> {

  if (offset >= values.length) {
    const error = new BadRequestError(`The offset of ${offset} is not valid!`);
    error.additionalInformation = {
      processModelListLength: values.length,
      offsetUsed: offset,
    } as any; //eslint-disable-line

    throw error;
  }

  let processModelSubset = offset > 0
    ? values.slice(offset)
    : values;

  const limitIsOutsideOfProcessModelList = limit < 1 || limit >= processModelSubset.length;
  if (limitIsOutsideOfProcessModelList) {
    return processModelSubset;
  }

  processModelSubset = processModelSubset.slice(0, limit);

  return processModelSubset;

}
