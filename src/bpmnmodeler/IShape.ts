import {IDocumentation} from './bpmnElements/IDocumentation';
import {IModdleElement} from './index';

export interface IShape {
  businessObject: IModdleElement;
  id: string;
  type: string;
  label: IShape;
  x: number;
  y: number;
  width: number;
  height: number;
  documentation?: Array<IDocumentation>;
  $type: string;
}
