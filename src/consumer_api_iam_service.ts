import {IIdentity} from '@essential-projects/core_contracts';

export interface IClaimConfig {
  [name: string]: Array<string>;
}

export class ConsumerApiIamService {

  public config: any;

  public hasClaim(identity: IIdentity, claim: string): Promise<boolean> {
    if (this.config[identity.name] === undefined) {
      return Promise.resolve(false);
    }

    const claimsOfIdentity: Array<string> = this.config[identity.name];

    return Promise.resolve(claimsOfIdentity.includes(claim));
  }
}
