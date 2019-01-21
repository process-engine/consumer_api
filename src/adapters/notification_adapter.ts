import * as jsonwebtoken from 'jsonwebtoken';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, TokenBody} from '@essential-projects/iam_contracts';
import {Messages} from '@process-engine/consumer_api_contracts';

export class NotificationAdapter {

  private readonly _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator) {
    this._eventAggregator = eventAggregator;
  }

  public onUserTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const attachResultCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage): void => {
      message.userTaskResult = message.userTaskResult;
      callback(message);
    };

    return this._createSubscription(eventName, attachResultCallback, subscribeOnce);
  }

  public onUserTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const attachResultCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage): void => {
      message.userTaskResult = message.userTaskResult;
      callback(message);
    };

    return this._createSubscription(eventName, attachResultCallback, subscribeOnce);
  }

  public onUserTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const identityCheckCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        message.userTaskResult = message.userTaskResult;
        callback(message);
      }
    };

    return this._createSubscription(eventName, identityCheckCallback, subscribeOnce);
  }

  public onUserTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const identityCheckCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        message.userTaskResult = message.userTaskResult;
        callback(message);
      }
    };

    return this._createSubscription(eventName, identityCheckCallback, subscribeOnce);
  }

  public onManualTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    return this._createSubscription(eventName, callback, subscribeOnce);
  }

  public onManualTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    return this._createSubscription(eventName, callback, subscribeOnce);
  }

  public onManualTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    const identityCheckCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        callback(message);
      }
    };

    return this._createSubscription(eventName, identityCheckCallback, subscribeOnce);
  }

  public onManualTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    const identityCheckCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        callback(message);
      }
    };

    return this._createSubscription(eventName, identityCheckCallback, subscribeOnce);
  }

  public onProcessStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processStarted;

    return this._createSubscription(eventName, callback, subscribeOnce);
  }

  public onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
    subscribeOnce: boolean,
  ): Subscription {

    const processWithIdStartedMessageEventName: string = Messages.EventAggregatorSettings.messagePaths.processInstanceStarted
      .replace(Messages.EventAggregatorSettings.messageParams.processModelId, processModelId);

    return this._createSubscription(processWithIdStartedMessageEventName, callback, subscribeOnce);
  }

  public onProcessEnded(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessEndedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processEnded;

    return this._createSubscription(eventName, callback, subscribeOnce);
  }

  public onProcessTerminated(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessTerminatedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processTerminated;

    return this._createSubscription(eventName, callback, subscribeOnce);
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): void {
    this._eventAggregator.unsubscribe(subscription);
  }

  private _createSubscription(eventName: string, callback: EventReceivedCallback, subscribeOnce: boolean): Subscription {

    const performSanitationCallback: EventReceivedCallback = (message: Messages.Internal.BaseInternalEventMessage): void => {
      const sanitizedMessage: Messages.Public.BpmnEvents.TerminateEndEventReachedMessage =
        this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    if (subscribeOnce) {
      return this._eventAggregator.subscribeOnce(eventName, performSanitationCallback);
    }

    return this._eventAggregator.subscribe(eventName, performSanitationCallback);
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
