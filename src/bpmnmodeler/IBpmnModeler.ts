import {IBpmnFunction} from './IBpmnFunction';

export interface IBpmnModeler {
  _definitions: any;
  attachTo(dom: HTMLElement): void;
  detach(): void;
  saveXML(options: any, callback: (error: Error, result: String) => void): void;
  saveSVG(options: any, callback: (error: Error, result: String) => void): void;
  importXML(xml: string, errorHandler: (err: Error) => void): void;
  get(object: string): any;
}
