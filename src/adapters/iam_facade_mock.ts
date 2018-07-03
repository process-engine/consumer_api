import {IIdentity} from '@essential-projects/iam_contracts';
import {IIamFacade} from '@process-engine/process_engine_contracts';

// TODO: This mock will be removed, when the consumer api itself is capable of authenticating itself
// against the external authority.
// Until then, we need this mock for the ConsumerApiService, so that it is able to retrieve a full process model,
// regardless of the requesting users access rights.
// If we didn't have that option, then we would not be able to execute a process instance, since it is very possible
// that the process model we pass to the executeProcessService will be incomplete.
export class IamFacadeMock implements IIamFacade {

  public async checkIfUserCanAccessLane(identity: IIdentity, laneId: string): Promise<boolean> {
    return true;
  }

}
