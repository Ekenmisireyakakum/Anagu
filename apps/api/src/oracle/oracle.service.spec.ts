import { Pool } from 'pg';
import { MQTT_TOPICS } from '@anagu/shared';
import { MqttService } from '../mqtt/mqtt.service';
import { MockInstitutionalService } from './mock-institutional.service';
import { MockCommunityService } from './mock-community.service';
import { OracleService } from './oracle.service';

jest.setTimeout(20000);

describe('OracleService Integration', () => {
  let pool: Pool;
  let mqttService: MqttService;
  let oracleService: OracleService;
  const createdApplicationIds: string[] = [];
  let testUserId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://anagu:anagu_password@localhost:5432/anagu_db',
    });

    mqttService = new MqttService();
    mqttService.onModuleInit();
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    oracleService = new OracleService(
      pool,
      mqttService,
      new MockInstitutionalService(),
      new MockCommunityService(),
    );

    const userRes = await pool.query(
      `INSERT INTO anagu.users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'CITIZEN', 'Oracle Test User')
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [`oracle-test-${Date.now()}@anagu.local`, 'test-hash'],
    );
    testUserId = userRes.rows[0].id;
  });

  afterAll(async () => {
    if (createdApplicationIds.length > 0) {
      await pool.query(
        'DELETE FROM anagu.oracle_verifications WHERE application_id = ANY($1)',
        [createdApplicationIds],
      );
      await pool.query(
        'DELETE FROM anagu.applications WHERE id = ANY($1)',
        [createdApplicationIds],
      );
    }
    if (testUserId) {
      await pool.query('DELETE FROM anagu.users WHERE id = $1', [testUserId]);
    }
    await pool.end();
    mqttService.onModuleDestroy();
  });

  async function createTestApp(): Promise<string> {
    const res = await pool.query(
      `INSERT INTO anagu.applications (applicant_id, status, application_data)
       VALUES ($1, 'SUBMITTED', '{}')
       RETURNING id`,
      [testUserId],
    );
    const id = res.rows[0].id;
    createdApplicationIds.push(id);
    return id;
  }

  it('returns VERIFIED for a valid parcel with institutional and community confirmation', async () => {
    const applicationId = await createTestApp();
    const result = await oracleService.verifyOwnership({
      applicationId,
      parcelReference: 'LG-VI-100',
      claimantName: 'Adebayo Ogunleye',
      nationalIdHash: '0xabc123',
      titleDeedHash: '0xdef456',
    });
    expect(result.overallOutcome).toBe('VERIFIED');
    expect(result.institutionalVerified).toBe(true);
    expect(result.communityVerified).toBe(true);
  });

  it('returns DISPUTED when parcelReference ends with -DISPUTED', async () => {
    const applicationId = await createTestApp();
    const result = await oracleService.verifyOwnership({
      applicationId,
      parcelReference: 'LG-VI-999-DISPUTED',
      claimantName: 'Adebayo Ogunleye',
      titleDeedHash: '0xdef456',
    });
    expect(result.overallOutcome).toBe('DISPUTED');
    expect(result.institutionalVerified).toBe(false);
  });

  it('returns INCONCLUSIVE when parcelReference ends with -NOATTEST', async () => {
    const applicationId = await createTestApp();
    const result = await oracleService.verifyOwnership({
      applicationId,
      parcelReference: 'LG-VI-998-NOATTEST',
      claimantName: 'Adebayo Ogunleye',
      titleDeedHash: '0xdef456',
    });
    expect(result.overallOutcome).toBe('INCONCLUSIVE');
    expect(result.institutionalVerified).toBe(true);
    expect(result.communityVerified).toBe(false);
  });

  it('persists verification record to anagu.oracle_verifications', async () => {
    const applicationId = await createTestApp();
    await oracleService.verifyOwnership({
      applicationId,
      parcelReference: 'LG-LK-201',
      claimantName: 'Chinedu Okafor',
      titleDeedHash: '0x112233',
    });
    const stored = await oracleService.getLatestVerification(applicationId);
    expect(stored).not.toBeNull();
    expect(stored?.applicationId).toBe(applicationId);
    expect(stored?.overallOutcome).toBe('VERIFIED');
  });

  it('publishes OWNERSHIP_VERIFIED MQTT message when outcome is VERIFIED', async () => {
    const applicationId = await createTestApp();
    const received = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timeout waiting for OWNERSHIP_VERIFIED')),
        5000,
      );
      mqttService.subscribe(MQTT_TOPICS.OWNERSHIP_VERIFIED, (payload) => {
        if (payload?.applicationId === applicationId) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    await oracleService.verifyOwnership({
      applicationId,
      parcelReference: 'LG-IK-505',
      claimantName: 'Funke Akindele',
      titleDeedHash: '0x778899',
    });

    const msg = await received;
    expect(msg.applicationId).toBe(applicationId);
    expect(msg.overallOutcome).toBe('VERIFIED');
  });
});
