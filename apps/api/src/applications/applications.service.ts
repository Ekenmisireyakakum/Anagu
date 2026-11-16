import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { ApplicationStatus, MQTT_TOPICS } from '@anagu/shared';
import { MqttService } from '../mqtt/mqtt.service';
import { OracleService } from '../oracle/oracle.service';
import { CreateApplicationDto } from './dto/create-application.dto';

export interface LandApplication {
  id: string;
  applicantId: string;
  parcelId: string | null;
  status: ApplicationStatus;
  applicationData: Record<string, unknown>;
  submittedAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly mqttService: MqttService,
    private readonly oracleService: OracleService,
  ) {}

  private mapRow(row: any): LandApplication {
    return {
      id: row.id,
      applicantId: row.applicant_id,
      parcelId: row.parcel_id,
      status: row.status as ApplicationStatus,
      applicationData: row.application_data ?? {},
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
    };
  }

  async createApplication(
    applicantId: string,
    dto: CreateApplicationDto,
  ): Promise<{ id: string; status: ApplicationStatus; submittedAt: Date }> {
    const applicationData = {
      ...(dto.applicationData ?? {}),
      parcelReference: dto.parcelReference,
      claimantName: dto.claimantName,
      nationalIdHash: dto.nationalIdHash ?? null,
      titleDeedHash: dto.titleDeedHash ?? null,
    };

    const insertRes = await this.pool.query(
      `INSERT INTO anagu.applications (applicant_id, parcel_id, status, application_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, submitted_at`,
      [
        applicantId,
        dto.parcelId ?? null,
        ApplicationStatus.SUBMITTED,
        JSON.stringify(applicationData),
      ],
    );

    const row = insertRes.rows[0];
    const id: string = row.id;

    try {
      await this.mqttService.publish(
        MQTT_TOPICS.APPLICATION_SUBMITTED,
        {
          applicationId: id,
          applicantId,
          parcelReference: dto.parcelReference,
          status: ApplicationStatus.SUBMITTED,
          submittedAt: row.submitted_at,
        },
        1,
      );
    } catch (err) {
      this.logger.warn(`Failed to publish APPLICATION_SUBMITTED: ${err}`);
    }

    // Trigger oracle verification asynchronously; never auto-approves to APPROVED
    this.oracleService
      .verifyOwnership({
        applicationId: id,
        parcelReference: dto.parcelReference,
        claimantName: dto.claimantName,
        nationalIdHash: dto.nationalIdHash,
        titleDeedHash: dto.titleDeedHash,
      })
      .then((result) => {
        if (result.overallOutcome === 'VERIFIED') {
          return this.updateApplicationStatus(
            id,
            ApplicationStatus.OWNERSHIP_VERIFICATION,
          );
        }
        return undefined;
      })
      .catch((err) => {
        this.logger.warn(
          `Async oracle verification failed for application ${id}: ${err}`,
        );
      });

    return {
      id,
      status: row.status as ApplicationStatus,
      submittedAt: row.submitted_at,
    };
  }

  async listApplications(applicantId?: string): Promise<LandApplication[]> {
    const res = await this.pool.query(
      `SELECT id, applicant_id, parcel_id, status, application_data, submitted_at, updated_at
       FROM anagu.applications
       WHERE ($1::uuid IS NULL OR applicant_id = $1::uuid)
       ORDER BY submitted_at DESC`,
      [applicantId ?? null],
    );
    return res.rows.map((row) => this.mapRow(row));
  }

  async getApplicationById(id: string): Promise<LandApplication | null> {
    const res = await this.pool.query(
      `SELECT id, applicant_id, parcel_id, status, application_data, submitted_at, updated_at
       FROM anagu.applications
       WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async updateApplicationStatus(
    id: string,
    newStatus: ApplicationStatus,
  ): Promise<LandApplication | null> {
    const res = await this.pool.query(
      `UPDATE anagu.applications
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, applicant_id, parcel_id, status, application_data, submitted_at, updated_at`,
      [id, newStatus],
    );
    if (res.rows.length === 0) return null;
    const updated = this.mapRow(res.rows[0]);

    try {
      await this.mqttService.publish(
        MQTT_TOPICS.APPLICATION_STATUS_CHANGED,
        {
          applicationId: id,
          status: newStatus,
          updatedAt: updated.updatedAt,
        },
        1,
      );
    } catch (err) {
      this.logger.warn(`Failed to publish APPLICATION_STATUS_CHANGED: ${err}`);
    }

    return updated;
  }
}
