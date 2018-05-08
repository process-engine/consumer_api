import {IModdleElement} from './IModdleElement';

export interface IScriptTaskElement extends IModdleElement {
  script?: string;
  scriptFormat?: string;
  resultVariable?: string;
}
