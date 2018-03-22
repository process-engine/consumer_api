import {IIdentity} from '@essential-projects/core_contracts';

export interface IClaimConfig {
  [name: string]: Array<string>;
}

export class ConsumerApiIamService {

  private claimConfig: IClaimConfig = {};

  constructor(claimConfig: IClaimConfig) {
    this.claimConfig = claimConfig;
  }

  public hasClaim(identity: IIdentity, claim: string): Promise<boolean> {
    if (this.claimConfig[identity.name] === undefined) {
      return Promise.resolve(false);
    }

    const claimsOfIdentity: Array<string> = this.claimConfig[identity.name];

    return Promise.resolve(claimsOfIdentity.includes(claim));
  }
}
