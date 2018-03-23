import {IUserTaskEntity} from '@process-engine/process_engine_contracts';

export interface ICorrelationCache {
  [correlationId: string]: string;
}

export type IWidgetConfig = {}; // sadly, our current widgetConfigs don't share any similarities

export enum FormWidgetFieldType {
  string = 'string',
  boolean = 'boolean',
  enumeration = 'enum',
  long = 'long',
}

export interface IFormWidgetField<TValue> {
  id: string;
  label: string;
  type: FormWidgetFieldType;
  defaultValue: TValue;
  value?: TValue;
}

export type IFormWidgetStringField = IFormWidgetField<string>;
export type IFormWidgetBooleanField = IFormWidgetField<boolean>;
export interface IFormWidgetEnumField extends IFormWidgetField<string> {
  enumValues: Array<IFormWidgetEnumValue>;
}
export interface IFormWidgetEnumValue {
  label: string;
  value: string;
}

export type SpecificFormWidgetField = IFormWidgetStringField | IFormWidgetBooleanField | IFormWidgetEnumField;

export enum WidgetType {
  form = 'form',
  confirm = 'confirm',
}

export interface IFormWidgetConfig extends IWidgetConfig {
  fields: Array<SpecificFormWidgetField>;
}

// ConfirmWidget-types
export enum UserTaskProceedAction {
  proceed = 'proceed',
  cancel = 'cancel',
}

export interface IConfirmWidgetAction {
  action: UserTaskProceedAction;
  label: string;
}

export interface IConfirmWidgetConfig extends IWidgetConfig {
  message: string;
  actions: Array<IConfirmWidgetAction>;
}

// UserTaskConfig
export type WidgetConfig = IFormWidgetConfig | IConfirmWidgetConfig;

export interface IUserTaskConfig {
  userTaskEntity: IUserTaskEntity;
  id: string;
  title: string;
  widgetType: WidgetType;
  widgetConfig: WidgetConfig;
}

export interface INodeDefFormFieldValue {
  id: string;
  name: string;
}

export interface INodeDefFormField {
  id: string;
  type: FormWidgetFieldType;
  label: string;
  formValues?: Array<INodeDefFormFieldValue>;
  defaultValue: string;
}

export interface UiConfigLayoutElement {
  key: string;
  label: string;
  isCancel?: boolean;
}
