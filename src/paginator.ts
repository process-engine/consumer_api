import {BadRequestError} from '@essential-projects/errors_ts';

export function applyPagination<TValue>(values: Array<TValue>, offset: number, limit: number): Array<TValue> {

  if (offset > values.length) {
    const error = new BadRequestError(`The offset of ${offset} is out of bounds!`);
    error.additionalInformation = {
      numberOfItemsInValueList: values.length,
      offsetUsed: offset,
    } as any; //eslint-disable-line

    throw error;
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
