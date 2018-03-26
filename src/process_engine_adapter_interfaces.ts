// tslint:disable:max-classes-per-file
import {UserTaskFormFieldType} from '@process-engine/consumer_api_contracts';
import {IUserTaskEntity} from '@process-engine/process_engine_contracts';

export class CorrelationCache {
  [correlationId: string]: string;
}

export enum MessageAction {
  event = 'event',
  abort = 'abort',
  proceed = 'proceed',
}

export class FormWidgetField<TValue> {
  public id: string;
  public label: string;
  public type: UserTaskFormFieldType;
  public defaultValue: TValue;
  public value?: TValue;
}

export type FormWidgetStringField = FormWidgetField<string>;
export type FormWidgetBooleanField = FormWidgetField<boolean>;
export class FormWidgetEnumField extends FormWidgetField<string> {
  public enumValues: Array<IFormWidgetEnumValue>;
}
export interface IFormWidgetEnumValue {
  label: string;
  value: string;
}

export type SpecificFormWidgetField = FormWidgetStringField | FormWidgetBooleanField | FormWidgetEnumField;

export class FormWidgetConfig {
  public fields: Array<SpecificFormWidgetField>;
}

export type WidgetConfig = FormWidgetConfig;
export class NodeDefFormFieldValue {
  public id: string;
  public name: string;
}

export class NodeDefFormField {
  public id: string;
  public type: UserTaskFormFieldType;
  public label: string;
  public formValues?: Array<NodeDefFormFieldValue>;
  public defaultValue: string;
}
