'use client';

import { useState } from 'react';
import type { AuditLogEntry, MqttMessageLog, SafeUser, UserRole } from './types';

interface MonitoringAndAdminPanelProps {
  mode: 'mqtt' | 'audit' | 'users';
  user: SafeUser;
  mqttLogs: MqttMessageLog[];
  auditLogs: AuditLogEntry[];
  usersList: SafeUser[];
  onRefresh: () => Promise<void>;
}

const ROLES: UserRole[] = [
  'CITIZEN',
  'SURVEYOR',
  'REGISTRAR',
  'LAND_ADMINISTRATOR',
  'GOVERNOR',
];

export default function MonitoringAndAdminPanel({
  mode,
  user,
  mqttLogs,
  auditLogs,
  usersList,
  onRefresh,
}: MonitoringAndAdminPanelProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const updateUser = async (targetId: string, patch: { isActive?: boolean; role?: UserRole }) => {
    setUpdatingId(targetId);
    setFeedback(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'User update failed');
      setFeedback(`Updated account ${data.email} (Role: ${data.role}, Active: ${data.isActive}).`);
      await onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update user');
    } finally {
      setUpdatingId(null);
    }
  };

  if (mode === 'mqtt') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              MQTT QoS 1 Notification Stream
            </h3>
            <p className="text-xs text-slate-500">
              Real-time state transition events published across ANAGU registry topics.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {mqttLogs.length} Events
          </span>
        </div>
        <div className="divide-y divide-slate-200">
          {mqttLogs.map((msg) => (
            <div key={msg.id} className="p-4 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-semibold text-emerald-800">{msg.topic}</span>
                <span className="font-mono text-slate-500 tabular-nums">
                  QoS {msg.qos} · Target: {msg.recipientRole} ·{' '}
                  {new Date(msg.publishedAt).toLocaleString()}
                </span>
              </div>
              <pre className="bg-slate-50 border border-slate-200 rounded p-2.5 font-mono text-[11px] text-slate-700 overflow-x-auto">
                {JSON.stringify(msg.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'audit') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Immutable Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Logs authorized mutations as well as rejected RBAC or smart-contract policy violations.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {auditLogs.length} Entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor & Role</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{log.actorName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{log.actorRole}</div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-800">{log.action}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{log.entityId}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono border rounded ${
                        log.outcome === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 max-w-md">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Registry User Directory & RBAC Controls
          </h3>
          <p className="text-xs text-slate-500">
            Only LAND_ADMINISTRATOR may assign statutory roles or suspend accounts.
          </p>
        </div>
      </div>
      {feedback && (
        <div className="m-4 p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-800">
          {feedback}
        </div>
      )}
      {usersList.length === 0 ? (
        <div className="p-6 text-xs text-slate-500">
          Directory lookup is restricted to LAND_ADMINISTRATOR and REGISTRAR roles.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Wallet Address</th>
                <th className="py-2.5 px-4">Assigned Role</th>
                <th className="py-2.5 px-4">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usersList.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{u.fullName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    <div>{u.walletAddress}</div>
                    {u.walletVerified && (
                      <span className="inline-block mt-0.5 text-[10px] text-emerald-700 font-semibold">
                        MetaMask Verified
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      disabled={user.role !== 'LAND_ADMINISTRATOR' || updatingId === u.id}
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                      className="px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      disabled={
                        user.role !== 'LAND_ADMINISTRATOR' ||
                        updatingId === u.id ||
                        u.id === user.id
                      }
                      onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                      className={`px-2.5 py-1 text-xs font-mono border rounded disabled:opacity-50 ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
