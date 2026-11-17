import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type {
  AuditLogEntry,
  ContactSubmission,
  DigitalLandTitle,
  LandApplicationRecord,
  LandListingRecord,
  LandPurchaseRecord,
  MqttMessageLog,
  UserAccount,
} from './anagu-store';

export interface SupabaseStoreShape {
  users: UserAccount[];
  applications: LandApplicationRecord[];
  titles: DigitalLandTitle[];
  listings: LandListingRecord[];
  purchases: LandPurchaseRecord[];
  mqttLogs: MqttMessageLog[];
  auditLogs: AuditLogEntry[];
  contacts: ContactSubmission[];
  parcelStatusOverrides: Map<string, string>;
  nextTokenId: number;
  nextBlockNumber: number;
}

export interface SupabaseStatusInfo {
  configured: boolean;
  connected: boolean;
  schemaReady: boolean;
  supabaseUrl: string | null;
  jwksUrl: string | null;
  message: string;
  counts?: {
    users: number;
    applications: number;
    titles: number;
    listings: number;
    purchases: number;
  };
}

interface SupabaseRuntimeState {
  hydrated: boolean;
  lastHydratedAt: number;
  hydrating: Promise<void> | null;
  schemaReady: boolean | null;
  lastSchemaCheckAt: number;
  syncQueue: Promise<void>;
  jwks: ReturnType<typeof createRemoteJWKSet> | null;
}

const g = globalThis as typeof globalThis & {
  __anaguSupabaseRuntime?: SupabaseRuntimeState;
};

function getRuntimeState(): SupabaseRuntimeState {
  if (!g.__anaguSupabaseRuntime) {
    g.__anaguSupabaseRuntime = {
      hydrated: false,
      lastHydratedAt: 0,
      hydrating: null,
      schemaReady: null,
      lastSchemaCheckAt: 0,
      syncQueue: Promise.resolve(),
      jwks: null,
    };
  }
  return g.__anaguSupabaseRuntime;
}

export function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const jwksUrl =
    (process.env.SUPABASE_JWKS_URL || '').trim() ||
    (url ? `${url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json` : '');
  return {
    url,
    publishableKey,
    secretKey,
    jwksUrl,
    isConfigured: Boolean(url && (secretKey || publishableKey)),
  };
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.secretKey) return null;
  return createClient(cfg.url, cfg.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseAuthClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  const key = cfg.publishableKey || cfg.secretKey;
  if (!cfg.url || !key) return null;
  return createClient(cfg.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifySupabaseJwt(token: string): Promise<JWTPayload | null> {
  const cfg = getSupabaseConfig();
  if (!cfg.jwksUrl) return null;
  try {
    const state = getRuntimeState();
    if (!state.jwks) {
      state.jwks = createRemoteJWKSet(new URL(cfg.jwksUrl));
    }
    const { payload } = await jwtVerify(token, state.jwks, {
      issuer: `${cfg.url.replace(/\/$/, '')}/auth/v1`,
    });
    return payload;
  } catch {
    return null;
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    Boolean(error.message?.includes('Could not find the table')) ||
    Boolean(error.message?.includes('does not exist'))
  );
}

export async function checkSupabaseStatus(): Promise<SupabaseStatusInfo> {
  const cfg = getSupabaseConfig();
  if (!cfg.isConfigured) {
    return {
      configured: false,
      connected: false,
      schemaReady: false,
      supabaseUrl: null,
      jwksUrl: null,
      message: 'Supabase environment variables are not configured.',
    };
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      configured: false,
      connected: false,
      schemaReady: false,
      supabaseUrl: cfg.url,
      jwksUrl: cfg.jwksUrl || null,
      message: 'SUPABASE_SECRET_KEY is required on the server for database access.',
    };
  }

  try {
    const [usersRes, appsRes, titlesRes, listingsRes, purchasesRes] = await Promise.all([
      client.from('anagu_users').select('id', { count: 'exact' }).limit(1),
      client.from('anagu_applications').select('id', { count: 'exact' }).limit(1),
      client.from('anagu_titles').select('token_id', { count: 'exact' }).limit(1),
      client.from('anagu_listings').select('id', { count: 'exact' }).limit(1),
      client.from('anagu_purchases').select('id', { count: 'exact' }).limit(1),
    ]);

    if (usersRes.error) {
      if (isMissingTableError(usersRes.error)) {
        getRuntimeState().schemaReady = false;
        return {
          configured: true,
          connected: true,
          schemaReady: false,
          supabaseUrl: cfg.url,
          jwksUrl: cfg.jwksUrl || null,
          message:
            'Connected to Supabase. Run supabase/schema.sql in the Supabase SQL Editor to create the ANAGU tables.',
        };
      }
      return {
        configured: true,
        connected: false,
        schemaReady: false,
        supabaseUrl: cfg.url,
        jwksUrl: cfg.jwksUrl || null,
        message: usersRes.error.message || 'Unable to query Supabase.',
      };
    }

    getRuntimeState().schemaReady = true;
    return {
      configured: true,
      connected: true,
      schemaReady: true,
      supabaseUrl: cfg.url,
      jwksUrl: cfg.jwksUrl || null,
      message: 'Connected to Supabase PostgreSQL.',
      counts: {
        users: usersRes.count ?? 0,
        applications: appsRes.count ?? 0,
        titles: titlesRes.count ?? 0,
        listings: listingsRes.count ?? 0,
        purchases: purchasesRes.count ?? 0,
      },
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      schemaReady: false,
      supabaseUrl: cfg.url,
      jwksUrl: cfg.jwksUrl || null,
      message: err instanceof Error ? err.message : 'Supabase connection error.',
    };
  }
}

const HYDRATION_TTL_MS = 3000;

export async function hydrateStoreFromSupabase(
  store: SupabaseStoreShape,
  options?: { force?: boolean },
): Promise<void> {
  const runtime = getRuntimeState();
  if (runtime.hydrating) return runtime.hydrating;
  if (
    runtime.hydrated &&
    !options?.force &&
    (runtime.schemaReady === false
      ? Date.now() - runtime.lastSchemaCheckAt < 15_000
      : Date.now() - runtime.lastHydratedAt < HYDRATION_TTL_MS)
  ) {
    return;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    runtime.hydrated = true;
    runtime.lastHydratedAt = Date.now();
    return;
  }

  runtime.hydrating = (async () => {
    try {
      const { data: userRows, error: userErr } = await client
        .from('anagu_users')
        .select('*')
        .order('created_at', { ascending: true });

      if (userErr) {
        if (isMissingTableError(userErr)) {
          runtime.schemaReady = false;
          runtime.lastSchemaCheckAt = Date.now();
        }
        return;
      }

      runtime.schemaReady = true;
      runtime.lastSchemaCheckAt = Date.now();

      // If tables exist but are completely empty, seed initial ANAGU data into Supabase
      if (!userRows || userRows.length === 0) {
        await writeSnapshotToSupabase(client, store);
        return;
      }

      const [
        appsRes,
        titlesRes,
        listingsRes,
        purchasesRes,
        auditRes,
        mqttRes,
        contactsRes,
        overridesRes,
        metaRes,
      ] = await Promise.all([
        client.from('anagu_applications').select('data').order('submitted_at', { ascending: false }),
        client.from('anagu_titles').select('data').order('token_id', { ascending: false }),
        client.from('anagu_listings').select('data').order('created_at', { ascending: false }),
        client.from('anagu_purchases').select('data').order('purchased_at', { ascending: false }),
        client.from('anagu_audit_logs').select('data').order('created_at', { ascending: false }).limit(250),
        client.from('anagu_mqtt_logs').select('data').order('published_at', { ascending: false }).limit(250),
        client.from('anagu_contacts').select('*').order('created_at', { ascending: false }),
        client.from('anagu_parcel_overrides').select('*'),
        client.from('anagu_meta').select('*'),
      ]);

      store.users = userRows.map((row) => ({
        id: String(row.id),
        email: String(row.email),
        passwordHash: String(row.password_hash || ''),
        role: row.role,
        fullName: String(row.full_name),
        phone: String(row.phone || ''),
        walletAddress: String(row.wallet_address),
        walletVerified: Boolean(row.wallet_verified),
        walletLinkedAt: row.wallet_linked_at ?? null,
        isActive: Boolean(row.is_active),
        createdAt: String(row.created_at),
      }));

      if (appsRes.data && appsRes.data.length > 0) {
        store.applications = appsRes.data.map((r) => r.data as LandApplicationRecord);
      }
      if (titlesRes.data && titlesRes.data.length > 0) {
        store.titles = titlesRes.data.map((r) => r.data as DigitalLandTitle);
      }
      if (listingsRes.data && listingsRes.data.length > 0) {
        store.listings = listingsRes.data.map((r) => r.data as LandListingRecord);
      }
      if (purchasesRes.data) {
        store.purchases = purchasesRes.data.map((r) => r.data as LandPurchaseRecord);
      }
      if (auditRes.data && auditRes.data.length > 0) {
        store.auditLogs = auditRes.data.map((r) => r.data as AuditLogEntry);
      }
      if (mqttRes.data && mqttRes.data.length > 0) {
        store.mqttLogs = mqttRes.data.map((r) => r.data as MqttMessageLog);
      }
      if (contactsRes.data) {
        store.contacts = contactsRes.data.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          email: String(r.email),
          organization: String(r.organization || 'Public Inquiry'),
          subject: String(r.subject || 'General Inquiry'),
          message: String(r.message),
          createdAt: String(r.created_at),
        }));
      }
      if (overridesRes.data) {
        store.parcelStatusOverrides = new Map(
          overridesRes.data.map((r) => [String(r.parcel_id), String(r.status)]),
        );
      }
      if (metaRes.data) {
        for (const row of metaRes.data) {
          if (row.key === 'counters' && row.value && typeof row.value === 'object') {
            const val = row.value as { nextTokenId?: number; nextBlockNumber?: number };
            if (typeof val.nextTokenId === 'number') store.nextTokenId = val.nextTokenId;
            if (typeof val.nextBlockNumber === 'number') store.nextBlockNumber = val.nextBlockNumber;
          }
        }
      }
    } catch {
      // Keep in-memory store operational if Supabase is temporarily unreachable
    } finally {
      runtime.hydrated = true;
      runtime.lastHydratedAt = Date.now();
      runtime.hydrating = null;
    }
  })();

  return runtime.hydrating;
}

async function writeSnapshotToSupabase(
  client: SupabaseClient,
  store: SupabaseStoreShape,
): Promise<void> {
  const ops: PromiseLike<unknown>[] = [];

  if (store.users.length > 0) {
    ops.push(
      client.from('anagu_users').upsert(
        store.users.map((u) => ({
          id: u.id,
          email: u.email,
          password_hash: u.passwordHash,
          role: u.role,
          full_name: u.fullName,
          phone: u.phone,
          wallet_address: u.walletAddress,
          wallet_verified: Boolean(u.walletVerified),
          wallet_linked_at: u.walletLinkedAt ?? null,
          is_active: u.isActive,
          created_at: u.createdAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.applications.length > 0) {
    ops.push(
      client.from('anagu_applications').upsert(
        store.applications.map((a) => ({
          id: a.id,
          applicant_id: a.applicantId,
          parcel_reference: a.parcelReference,
          status: a.status,
          data: a,
          submitted_at: a.submittedAt,
          updated_at: a.updatedAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.titles.length > 0) {
    ops.push(
      client.from('anagu_titles').upsert(
        store.titles.map((t) => ({
          token_id: t.tokenId,
          application_id: t.applicationId,
          parcel_reference: t.parcelReference,
          owner_id: t.ownerId,
          owner_address: t.ownerAddress,
          is_revoked: t.isRevoked,
          data: t,
          issued_at: t.issuedAt,
        })),
        { onConflict: 'token_id' },
      ),
    );
  }

  if (store.listings.length > 0) {
    ops.push(
      client.from('anagu_listings').upsert(
        store.listings.map((l) => ({
          id: l.id,
          parcel_reference: l.parcelReference,
          status: l.status,
          verification_status: l.verificationStatus || 'VERIFIED',
          token_id: l.tokenId,
          data: l,
          created_at: l.createdAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.purchases.length > 0) {
    ops.push(
      client.from('anagu_purchases').upsert(
        store.purchases.map((p) => ({
          id: p.id,
          listing_id: p.listingId,
          parcel_reference: p.parcelReference,
          buyer_id: p.buyerId,
          token_id: p.tokenId,
          data: p,
          purchased_at: p.purchasedAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.auditLogs.length > 0) {
    ops.push(
      client.from('anagu_audit_logs').upsert(
        store.auditLogs.slice(0, 100).map((a) => ({
          id: a.id,
          actor_id: a.actorId,
          entity_type: a.entityType,
          entity_id: a.entityId,
          outcome: a.outcome,
          data: a,
          created_at: a.timestamp,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.mqttLogs.length > 0) {
    ops.push(
      client.from('anagu_mqtt_logs').upsert(
        store.mqttLogs.slice(0, 100).map((m) => ({
          id: m.id,
          topic: m.topic,
          recipient_role: m.recipientRole,
          data: m,
          published_at: m.publishedAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.contacts.length > 0) {
    ops.push(
      client.from('anagu_contacts').upsert(
        store.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          organization: c.organization,
          subject: c.subject,
          message: c.message,
          created_at: c.createdAt,
        })),
        { onConflict: 'id' },
      ),
    );
  }

  if (store.parcelStatusOverrides.size > 0) {
    ops.push(
      client.from('anagu_parcel_overrides').upsert(
        Array.from(store.parcelStatusOverrides.entries()).map(([parcel_id, status]) => ({
          parcel_id,
          status,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'parcel_id' },
      ),
    );
  }

  ops.push(
    client.from('anagu_meta').upsert(
      {
        key: 'counters',
        value: {
          nextTokenId: store.nextTokenId,
          nextBlockNumber: store.nextBlockNumber,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    ),
  );

  await Promise.allSettled(ops);
}

export function scheduleSupabaseSync(store: SupabaseStoreShape): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client) return Promise.resolve();

  const runtime = getRuntimeState();
  // Re-check schema periodically if tables were not created yet
  if (runtime.schemaReady === false && Date.now() - runtime.lastSchemaCheckAt < 15_000) {
    return runtime.syncQueue;
  }

  runtime.syncQueue = runtime.syncQueue
    .then(async () => {
      if (runtime.schemaReady !== true) {
        const probe = await client.from('anagu_meta').select('key').limit(1);
        runtime.lastSchemaCheckAt = Date.now();
        if (probe.error && isMissingTableError(probe.error)) {
          runtime.schemaReady = false;
          return;
        }
        runtime.schemaReady = true;
      }
      await writeSnapshotToSupabase(client, store);
      runtime.lastHydratedAt = Date.now();
    })
    .catch(() => {
      // Non-fatal: keep in-memory store responsive
    });

  return runtime.syncQueue;
}

export async function flushSupabaseSync(store: SupabaseStoreShape): Promise<void> {
  await scheduleSupabaseSync(store);
}
