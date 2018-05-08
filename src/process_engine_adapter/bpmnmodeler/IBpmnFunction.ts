import {IModdleElement, IShape} from './index';

export interface IBpmnFunction {
  trigger(selection: Array<IShape>, option: string): void;
}
