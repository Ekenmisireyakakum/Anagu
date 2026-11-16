import { Injectable } from '@nestjs/common';
import { CommunityCheckResult } from './interfaces/oracle.interfaces';

@Injectable()
export class MockCommunityService {
  async getAttestation(
    parcelReference: string,
    claimantName: string,
  ): Promise<CommunityCheckResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (parcelReference.endsWith('-NOATTEST')) {
      return {
        verified: false,
        attestationCount: 0,
        details: {
          reason: 'No community elder or traditional council attestations recorded',
          parcelReference,
        },
      };
    }

    return {
      verified: true,
      attestationCount: 3,
      details: {
        witnesses: ['Elder A', 'Elder B', 'Elder C'],
        claimantName,
        parcelReference,
      },
    };
  }
}
