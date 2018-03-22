import {IFormElement} from './IFormElement';
import {IModdleElement} from './IModdleElement';

export interface IExtensionElement extends IModdleElement {
  $type: string;
  values?: Array<any>;
}
