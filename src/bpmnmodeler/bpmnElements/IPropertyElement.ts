import {IModdleElement} from './IModdleElement';
import {IProperty} from './IProperty';

export interface IPropertyElement extends IModdleElement {
  values?: Array<IProperty>;
}
