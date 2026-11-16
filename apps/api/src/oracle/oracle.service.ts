import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { MQTT_TOPICS } from '@anagu/shared';
import { MqttService } from '../mqtt/mqtt.service';
import { MockInstitutionalService } from './mock-institutional.service';
import { MockCommunityService } from './mock-community.service';
import { OwnershipClaimDto } from './dto/ownership-claim.dto';
import {
  OracleOverallOutcome,
  OracleVerificationResult,
} from './interfaces/oracle.interfaces';

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly mqttService: MqttService,
    private readonly institutionalService: MockInstitutionalService,
    private readonly communityService: MockCommunityService,
  ) {}

  async verifyOwnership(dto: OwnershipClaimDto): Promise<OracleVerificationResult> {
    const [institutional, community] = await Promise.all([
      this.institutionalService.checkOwnership(
        dto.parcelReference,
        dto.claimantName,
        dto.nationalIdHash,
      ),
      this.communityService.getAttestation(dto.parcelReference, dto.claimantName),
    ]);

    let overallOutcome: OracleOverallOutcome;
    let notes: string;

    if (!institutional.verified) {
      overallOutcome = 'DISPUTED';
      notes = 'Institutional land registry check reported an ownership conflict.';
    } else if (!community.verified) {
      overallOutcome = 'INCONCLUSIVE';
      notes =
        'Institutional check passed, but community attestation is missing or incomplete.';
    } else if (!dto.titleDeedHash) {
      overallOutcome = 'PENDING';
      notes = 'Supporting title deed hash missing; legal verification pending.';
    } else {
      overallOutcome = 'VERIFIED';
      notes =
        'Both institutional registry records and community attestations confirmed ownership.';
    }

    const insertResult = await this.pool.query(
      `INSERT INTO anagu.oracle_verifications
         (application_id, institutional_verified, community_verified,
          institutional_details, community_details, overall_outcome, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, application_id, institutional_verified, community_verified,
                 institutional_details, community_details, overall_outcome, notes, verified_at`,
      [
        dto.applicationId,
        institutional.verified,
        community.verified,
        JSON.stringify(institutional.details),
        JSON.stringify(community.details),
        overallOutcome,
        notes,
      ],
    );

    const row = insertResult.rows[0];
    const result: OracleVerificationResult = {
      id: row.id,
      applicationId: row.application_id,
      institutionalVerified: row.institutional_verified,
      communityVerified: row.community_verified,
      institutionalDetails: row.institutional_details,
      communityDetails: row.community_details,
      overallOutcome: row.overall_outcome,
      notes: row.notes,
      verifiedAt: row.verified_at,
    };

    if (overallOutcome === 'VERIFIED') {
      try {
        await this.mqttService.publish(
          MQTT_TOPICS.OWNERSHIP_VERIFIED,
          {
            applicationId: dto.applicationId,
            parcelReference: dto.parcelReference,
            overallOutcome,
            verifiedAt: result.verifiedAt,
          },
          1,
        );
      } catch (err) {
        this.logger.warn(`Failed to publish OWNERSHIP_VERIFIED event: ${err}`);
      }
    }

    return result;
  }

  async getLatestVerification(
    applicationId: string,
  ): Promise<OracleVerificationResult | null> {
    const res = await this.pool.query(
      `SELECT id, application_id, institutional_verified, community_verified,
              institutional_details, community_details, overall_outcome, notes, verified_at
       FROM anagu.oracle_verifications
       WHERE application_id = $1
       ORDER BY verified_at DESC
       LIMIT 1`,
      [applicationId],
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      applicationId: row.application_id,
      institutionalVerified: row.institutional_verified,
      communityVerified: row.community_verified,
      institutionalDetails: row.institutional_details,
      communityDetails: row.community_details,
      overallOutcome: row.overall_outcome,
      notes: row.notes,
      verifiedAt: row.verified_at,
    };
  }
}
