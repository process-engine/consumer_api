import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Messages} from '@process-engine/consumer_api_contracts';

import {
  EmptyActivityFinishedMessage,
  EmptyActivityReachedMessage,
  EndEventReachedMessage,
  ManualTaskFinishedMessage,
  ManualTaskReachedMessage,
  ProcessStartedMessage,
  TerminateEndEventReachedMessage,
  UserTaskFinishedMessage,
  UserTaskReachedMessage,
} from '@process-engine/process_engine_contracts';

export class NotificationAdapter {

  private readonly _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator) {
    this._eventAggregator = eventAggregator;
  }

  public onEmptyActivityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.emptyActivityReached;

    const sanitationCallback: EventReceivedCallback = (message: EmptyActivityReachedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.EmptyActivityReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.emptyActivityFinished;

    const sanitationCallback: EventReceivedCallback = (message: EmptyActivityFinishedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.EmptyActivityFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.emptyActivityReached;

    const sanitationCallback: EventReceivedCallback = (message: EmptyActivityReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.EmptyActivityReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.emptyActivityFinished;

    const sanitationCallback: EventReceivedCallback = (message: EmptyActivityFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.EmptyActivityReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const sanitationCallback: EventReceivedCallback = (message: UserTaskReachedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      sanitizedMessage.userTaskResult = message.userTaskResult;
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const sanitationCallback: EventReceivedCallback = (message: UserTaskFinishedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      sanitizedMessage.userTaskResult = message.userTaskResult;
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const sanitationCallback: EventReceivedCallback = (message: UserTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        sanitizedMessage.userTaskResult = message.userTaskResult;
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const sanitationCallback: EventReceivedCallback = (message: UserTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        sanitizedMessage.userTaskResult = message.userTaskResult;
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    const sanitationCallback: EventReceivedCallback = (message: ManualTaskReachedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    const sanitationCallback: EventReceivedCallback = (message: ManualTaskFinishedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.ManualTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    const sanitationCallback: EventReceivedCallback = (message: ManualTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    const sanitationCallback: EventReceivedCallback = (message: ManualTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessStarted(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessStartedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processStarted;

    const sanitationCallback: EventReceivedCallback = (message: ProcessStartedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processStarted;

    const sanitationCallback: EventReceivedCallback = (message: ProcessStartedMessage): void => {

      const processModelIdsDoNotMatch: boolean = message.processModelId !== processModelId;
      if (processModelIdsDoNotMatch) {
        return;
      }

      const sanitizedMessage: Messages.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessEnded(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessEndedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processEnded;

    const sanitationCallback: EventReceivedCallback = (message: EndEventReachedMessage): void => {
      const sanitizedMessage: Messages.BpmnEvents.EndEventReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessTerminated(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessTerminatedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processTerminated;

    const sanitationCallback: EventReceivedCallback = (message: TerminateEndEventReachedMessage): void => {
      const sanitizedMessage: Messages.BpmnEvents.TerminateEndEventReachedMessage =
        this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public removeSubscription(subscription: Subscription): void {
    this._eventAggregator.unsubscribe(subscription);
  }

  private _createSubscription(eventName: string, callback: EventReceivedCallback, subscribeOnce: boolean): Subscription {

    if (subscribeOnce) {
      return this._eventAggregator.subscribeOnce(eventName, callback);
    }

    return this._eventAggregator.subscribe(eventName, callback);
  }

  private _checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private _sanitizeInternalMessageForPublicNotification<TPublic extends Messages.BaseEventMessage>(internalMesage: any): TPublic {

    const sanitizedMessage: Messages.BaseEventMessage = new Messages.BaseEventMessage(
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
