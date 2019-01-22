import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Messages} from '@process-engine/consumer_api_contracts';

export class NotificationAdapter {

  private readonly _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator) {
    this._eventAggregator = eventAggregator;
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskReachedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      sanitizedMessage.userTaskResult = message.userTaskResult;
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.Public.SystemEvents.UserTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.UserTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.Public.SystemEvents.UserTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskReachedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskReachedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ManualTaskFinishedMessage): void => {

      const identitiesMatch: boolean = this._checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage: Messages.Public.SystemEvents.ManualTaskReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
        callback(sanitizedMessage);
      }
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessStarted(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessStartedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processStarted;

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ProcessStartedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const processWithIdStartedMessageEventName: string = Messages.EventAggregatorSettings.messagePaths.processInstanceStarted
        .replace(Messages.EventAggregatorSettings.messageParams.processModelId, processModelId);

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.SystemEvents.ProcessStartedMessage): void => {
      const sanitizedMessage: Messages.Public.SystemEvents.ProcessStartedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(processWithIdStartedMessageEventName, sanitationCallback, subscribeOnce);
  }

  public onProcessEnded(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessEndedCallback, subscribeOnce: boolean): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.processEnded;

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.BpmnEvents.EndEventReachedMessage): void => {
      const sanitizedMessage: Messages.Public.BpmnEvents.EndEventReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
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

    const sanitationCallback: EventReceivedCallback = (message: Messages.Internal.BpmnEvents.TerminateEndEventReachedMessage): void => {
      const sanitizedMessage: Messages.Public.BpmnEvents.TerminateEndEventReachedMessage =
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
