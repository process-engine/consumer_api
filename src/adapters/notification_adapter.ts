import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Messages} from '@process-engine/consumer_api_contracts';

import {
  BaseSystemEventMessage,
  BoundaryEventFinishedMessage,
  BoundaryEventReachedMessage,
  CallActivityFinishedMessage,
  CallActivityReachedMessage,
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

  private readonly eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public onEmptyActivityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.emptyActivityReached;

    const sanitationCallback = (message: EmptyActivityReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.emptyActivityFinished;

    const sanitationCallback = (message: EmptyActivityFinishedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.emptyActivityReached;

    const sanitationCallback = (message: EmptyActivityReachedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage(message);
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onEmptyActivityForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnEmptyActivityFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.emptyActivityFinished;

    const sanitationCallback = (message: EmptyActivityFinishedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage(message);
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskWaitingCallback, subscribeOnce: boolean): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const sanitationCallback = (message: UserTaskReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskFinished(identity: IIdentity, callback: Messages.CallbackTypes.OnUserTaskFinishedCallback, subscribeOnce: boolean): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const sanitationCallback = (message: UserTaskFinishedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage<Messages.SystemEvents.UserTaskFinishedMessage>(message);
      sanitizedMessage.userTaskResult = message.userTaskResult;
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.userTaskReached;

    const sanitationCallback = (message: UserTaskReachedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage(message);
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onUserTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnUserTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.userTaskFinished;

    const sanitationCallback = (message: UserTaskFinishedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage<Messages.SystemEvents.UserTaskFinishedMessage>(message);
        sanitizedMessage.userTaskResult = message.userTaskResult;
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    const sanitationCallback = (message: ManualTaskReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    const sanitationCallback = (message: ManualTaskFinishedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskForIdentityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.manualTaskReached;

    const sanitationCallback = (message: ManualTaskReachedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage(message);
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onManualTaskForIdentityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnManualTaskFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.manualTaskFinished;

    const sanitationCallback = (message: ManualTaskFinishedMessage): void => {

      const identitiesMatch = this.checkIfIdentityUserIDsMatch(identity, message.processInstanceOwner);
      if (identitiesMatch) {
        const sanitizedMessage = this.sanitizeMessage(message);
        callback(sanitizedMessage);
      }
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onCallActivityWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnCallActivityWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.callActivityReached;

    const sanitationCallback: EventReceivedCallback = (message: CallActivityReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onCallActivityFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnCallActivityFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.callActivityFinished;

    const sanitationCallback: EventReceivedCallback = (message: CallActivityFinishedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onBoundaryEventWaiting(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnBoundaryEventWaitingCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.boundaryEventReached;

    const sanitationCallback: EventReceivedCallback = (message: BoundaryEventReachedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.BoundaryEventReachedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onBoundaryEventFinished(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnBoundaryEventFinishedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName: string = Messages.EventAggregatorSettings.messagePaths.boundaryEventFinished;

    const sanitationCallback: EventReceivedCallback = (message: BoundaryEventFinishedMessage): void => {
      const sanitizedMessage: Messages.SystemEvents.BoundaryEventFinishedMessage = this._sanitizeInternalMessageForPublicNotification(message);
      callback(sanitizedMessage);
    };

    return this._createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessStarted(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessStartedCallback, subscribeOnce: boolean): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.processStarted;

    const sanitationCallback = (message: ProcessStartedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessWithProcessModelIdStarted(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessStartedCallback,
    processModelId: string,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.processStarted;

    const sanitationCallback = (message: ProcessStartedMessage): void => {

      const processModelIdsDoNotMatch = message.processModelId !== processModelId;
      if (processModelIdsDoNotMatch) {
        return;
      }

      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessEnded(identity: IIdentity, callback: Messages.CallbackTypes.OnProcessEndedCallback, subscribeOnce: boolean): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.processEnded;

    const sanitationCallback = (message: EndEventReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public onProcessTerminated(
    identity: IIdentity,
    callback: Messages.CallbackTypes.OnProcessTerminatedCallback,
    subscribeOnce: boolean,
  ): Subscription {

    const eventName = Messages.EventAggregatorSettings.messagePaths.processTerminated;

    const sanitationCallback = (message: TerminateEndEventReachedMessage): void => {
      const sanitizedMessage = this.sanitizeMessage(message);
      callback(sanitizedMessage);
    };

    return this.createSubscription(eventName, sanitationCallback, subscribeOnce);
  }

  public removeSubscription(subscription: Subscription): void {
    this.eventAggregator.unsubscribe(subscription);
  }

  private createSubscription(eventName: string, callback: EventReceivedCallback, subscribeOnce: boolean): Subscription {

    if (subscribeOnce) {
      return this.eventAggregator.subscribeOnce(eventName, callback);
    }

    return this.eventAggregator.subscribe(eventName, callback);
  }

  private checkIfIdentityUserIDsMatch(identityA: IIdentity, identityB: IIdentity): boolean {
    return identityA.userId === identityB.userId;
  }

  private sanitizeMessage<TPublic extends Messages.BaseEventMessage>(internalMesage: BaseSystemEventMessage): TPublic {

    const sanitizedMessage = new Messages.BaseEventMessage(
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
