import * as jsonwebtoken from 'jsonwebtoken';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, TokenBody} from '@essential-projects/iam_contracts';
import {Messages} from '@process-engine/consumer_api_contracts';

export class NotificationAdapter {

  private readonly _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator) {
    this._eventAggregator = eventAggregator;
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.UserTaskReachedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        sanitizedMessage.userTaskResult = message.userTaskResult;
        callback(sanitizedMessage);
      });
  }

  public onUserTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        sanitizedMessage.userTaskResult = message.userTaskResult;
        callback(sanitizedMessage);
      });
  }

  public onUserTaskForIdentityWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.UserTaskReachedMessage) => {

        const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
        if (identitiesMatch) {
          const sanitizedMessage: Messages.Public.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
          sanitizedMessage.userTaskResult = message.userTaskResult;
          callback(sanitizedMessage);
        }
      });
  }

  public onUserTaskForIdentityFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage) => {

        const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
        if (identitiesMatch) {
          const sanitizedMessage: Messages.Public.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
          sanitizedMessage.userTaskResult = message.userTaskResult;
          callback(sanitizedMessage);
        }
      });
  }

  public onManualTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskWaitingCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.ManualTaskReachedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  public onManualTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskFinishedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  public onManualTaskForIdentityWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskWaitingCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.ManualTaskReachedMessage) => {

        const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
        if (identitiesMatch) {
          const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
          callback(sanitizedMessage);
        }
      });
  }

  public onManualTaskForIdentityFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnManualTaskFinishedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage) => {

        const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
        if (identitiesMatch) {
          const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
          callback(sanitizedMessage);
        }
      });
  }

  public onProcessStarted(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessStartedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processStarted;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.SystemEvents.ProcessStartedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  public onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
  ): void {
    const processWithIdStartedMessageEventName: string = Messages.EventAggregatorSettings.messagePaths.processInstanceStarted
        .replace(Messages.EventAggregatorSettings.messageParams.processModelId, processModelId);
    this
      ._eventAggregator
      .subscribe(processWithIdStartedMessageEventName, (message: Messages.Internal.SystemEvents.ProcessStartedMessage) => {
        const sanitizedMessage: Messages.Public.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  public onProcessEnded(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessEndedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processEnded;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.BpmnEvents.EndEventReachedMessage) => {
        const sanitizedMessage: Messages.Public.BpmnEvents.EndEventReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  public onProcessTerminated(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessTerminatedCallback): void {
    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processTerminated;
    this
      ._eventAggregator
      .subscribe(eventName, (message: Messages.Internal.BpmnEvents.TerminateEndEventReachedMessage) => {
        const sanitizedMessage: Messages.Public.BpmnEvents.TerminateEndEventReachedMessage =
          this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      });
  }

  private _checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {

    const decodedRequestingIdentity: TokenBody = <TokenBody> jsonwebtoken.decode(identityA.token);
    const decodedUserTaskIdentity: TokenBody = <TokenBody> jsonwebtoken.decode(identityB.token);

    return decodedRequestingIdentity.sub === decodedUserTaskIdentity.sub;
  }

  private _sanitizeInternalMessageForPublicNotification
    <TInternal extends Messages.Internal.BaseInternalEventMessage,
    TPublic extends Messages.Public.BasePublicEventMessage>(internalMesage: TInternal): TPublic {

    const sanitizedMessage: Messages.Public.BasePublicEventMessage = new Messages.Public.BasePublicEventMessage(
      internalMesage.correlationId,
      internalMesage.processModelId,
      internalMesage.processInstanceId,
      internalMesage.flowNodeId,
      internalMesage.flowNodeInstanceId,
      internalMesage.currentToken,
    );

    return <TPublic> sanitizedMessage;
  }
}
