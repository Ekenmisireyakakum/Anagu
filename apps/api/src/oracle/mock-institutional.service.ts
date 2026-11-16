import { Injectable } from '@nestjs/common';
import { InstitutionalCheckResult } from './interfaces/oracle.interfaces';

@Injectable()
export class MockInstitutionalService {
  async checkOwnership(
    parcelReference: string,
    claimantName: string,
    nationalIdHash?: string,
  ): Promise<InstitutionalCheckResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (parcelReference.endsWith('-DISPUTED')) {
      return {
        verified: false,
        referenceId: null,
        details: {
          registry: 'LASRECCA',
          reason: 'Conflicting institutional ownership claim found in Lagos State Land Registry',
          parcelReference,
          claimantName,
        },
      };
    }

    return {
      verified: true,
      referenceId: `INST-${Date.now()}`,
      details: {
        registry: 'LASRECCA',
        confirmedOwner: claimantName,
        nationalIdMatched: Boolean(nationalIdHash),
        parcelReference,
      },
    };
  }
}
