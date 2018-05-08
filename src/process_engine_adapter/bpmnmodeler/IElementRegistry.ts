import {IShape} from './IShape';

export interface IElementRegistry {
  get(id: string): IShape;
  filter(filterMethod: (element: IShape) => Boolean): Array<IShape>;
}
