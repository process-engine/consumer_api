import {IShape} from './IShape';

export interface IEvent {
  type: string;
  element: IShape;
  newSelection?: Array<IShape>;
  oldSelection?: Array<IShape>;
}
