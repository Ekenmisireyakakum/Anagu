'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';

interface FraudScenarioReport {
  scenario: string;
  trials: number;
  anaguDetected: number;
  anaguRatePct: number;
  baselineDetected: number;
  baselineRatePct: number;
}

interface LatencyMetric {
  stage: string;
  meanMs: number;
  stdDevMs: number;
  minMs: number;
  maxMs: number;
}

interface StorageMetric {
  field: string;
  anaguBytes: number;
  baselineOnChainBytes: number;
}

interface MqttProfileResult {
  profile: string;
  latencyMs: number;
  packetLossPct: number;
  sent: number;
  delivered: number;
  deliveryRatePct: number;
  duplicatesPrevented: number;
}

interface EvaluationReport {
  executedAt: string;
  environmentNote: string;
  fraudScenarios: FraudScenarioReport[];
  latencyMetrics: LatencyMetric[];
  storageMetrics: StorageMetric[];
  storageSummary: {
    totalAnaguBytes: number;
    totalBaselineBytes: number;
    reductionPct: number;
  };
  mqttProfiles: MqttProfileResult[];
}

export default function EvaluationPage() {
  const [trialsPerScenario, setTrialsPerScenario] = useState(30);
  const [txCount, setTxCount] = useState(30);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runEvaluation = useCallback(async (trials: number, txs: number) => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialsPerScenario: trials, txCount: txs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Evaluation benchmark failed');
      setReport(data as EvaluationReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute benchmark');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    runEvaluation(30, 30);
  }, [runEvaluation]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Header & Parameters */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-mono text-emerald-700 font-semibold uppercase tracking-wide">
              Phase 7 · Baseline Simulator & Evaluation Suite
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              ANAGU vs. Conventional Paper Land Registry
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Executes live automated trials against ANAGU verification modules (SHA-256 document proofs, EPSG:4326 spatial overlap engine, institutional+community oracle, and Section 28 / Registrar NFT locks) alongside the Conventional Paper Baseline Simulator.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fraud Trials / Scenario
              </label>
              <select
                value={trialsPerScenario}
                onChange={(e) => setTrialsPerScenario(Number(e.target.value))}
                className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
              >
                <option value={10}>10 trials</option>
                <option value={20}>20 trials</option>
                <option value={30}>30 trials</option>
                <option value={50}>50 trials</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Latency Tx Sample
              </label>
              <select
                value={txCount}
                onChange={(e) => setTxCount(Number(e.target.value))}
                className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
              >
                <option value={30}>30 txs</option>
                <option value={45}>45 txs</option>
                <option value={60}>60 txs</option>
              </select>
            </div>
            <button
              type="button"
              disabled={running}
              onClick={() => runEvaluation(trialsPerScenario, txCount)}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {running ? 'Running Benchmark...' : 'Re-run Evaluation'}
            </button>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-900">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="bg-slate-100 border border-slate-300 rounded-md px-4 py-3 text-xs text-slate-700 flex flex-wrap justify-between gap-2">
              <span>{report.environmentNote}</span>
              <span className="font-mono text-slate-500 tabular-nums shrink-0">
                Executed: {new Date(report.executedAt).toLocaleString()}
              </span>
            </div>

            {/* 1. Fraud Detection Rate */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">
                  1. Fraud Detection Evaluation (4 Adversarial Scenarios)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison of ANAGU multi-layer controls against the conventional baseline verifying only file presence.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-6">Adversarial Scenario</th>
                      <th className="py-3 px-4 font-mono">Trials</th>
                      <th className="py-3 px-4">ANAGU Detection Rate</th>
                      <th className="py-3 px-6">Conventional Baseline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.fraudScenarios.map((row) => (
                      <tr key={row.scenario}>
                        <td className="py-3.5 px-6 font-medium text-slate-900">{row.scenario}</td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                          {row.trials}
                        </td>
                        <td className="py-3.5 px-4 min-w-[220px]">
                          <div className="flex items-center justify-between font-mono text-xs mb-1 tabular-nums">
                            <span className="font-semibold text-emerald-800">
                              {row.anaguDetected}/{row.trials}
                            </span>
                            <span className="font-semibold text-emerald-800">
                              {row.anaguRatePct}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-emerald-700"
                              style={{ width: `${row.anaguRatePct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-6 min-w-[200px]">
                          <div className="flex items-center justify-between font-mono text-xs mb-1 tabular-nums">
                            <span className="text-slate-600">
                              {row.baselineDetected}/{row.trials}
                            </span>
                            <span className="text-slate-600">{row.baselineRatePct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${row.baselineRatePct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. Latency & 3. Storage Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latency */}
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">
                    2. Computational Processing Latency ({txCount} Txs)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Measured per-stage execution time in milliseconds (mean, SD, min, max).
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-5">Pipeline Stage</th>
                        <th className="py-2.5 px-3 text-right">Mean (ms)</th>
                        <th className="py-2.5 px-3 text-right">SD</th>
                        <th className="py-2.5 px-5 text-right">Min / Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.latencyMetrics.map((m) => (
                        <tr key={m.stage}>
                          <td className="py-2.5 px-5 font-medium text-slate-800">{m.stage}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                            {m.meanMs.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                            ±{m.stdDevMs.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono tabular-nums text-slate-500">
                            {m.minMs.toFixed(2)} / {m.maxMs.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* On-Chain Storage */}
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      3. On-Chain Storage Overhead
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hash-only ERC-721 pointers vs. storing full GeoJSON + PII on-chain.
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-emerald-700 tabular-nums">
                      -{report.storageSummary.reductionPct}%
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {report.storageSummary.totalAnaguBytes} B vs {report.storageSummary.totalBaselineBytes} B
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-5">Data Field</th>
                        <th className="py-2.5 px-4 text-right">ANAGU (Bytes)</th>
                        <th className="py-2.5 px-5 text-right">Full On-Chain (Bytes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.storageMetrics.map((s) => (
                        <tr key={s.field}>
                          <td className="py-2.5 px-5 font-medium text-slate-800">{s.field}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-800 font-semibold">
                            {s.anaguBytes}
                          </td>
                          <td className="py-2.5 px-5 text-right font-mono tabular-nums text-slate-600">
                            {s.baselineOnChainBytes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* 4. MQTT & Offline Sync Reliability */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">
                  4. Network Degradation, MQTT QoS 1 & Offline Idempotency
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delivery reliability under simulated packet loss with QoS 1 PUBACK retries and offline key deduplication.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-6">Network Profile</th>
                      <th className="py-3 px-4 text-right">Latency</th>
                      <th className="py-3 px-4 text-right">Loss</th>
                      <th className="py-3 px-4 text-right">Delivered</th>
                      <th className="py-3 px-4 text-right">Delivery Rate</th>
                      <th className="py-3 px-6 text-right">Duplicates Prevented</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {report.mqttProfiles.map((p) => (
                      <tr key={p.profile}>
                        <td className="py-3 px-6 font-sans font-medium text-slate-900">
                          {p.profile}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{p.latencyMs} ms</td>
                        <td className="py-3 px-4 text-right text-slate-600">{p.packetLossPct}%</td>
                        <td className="py-3 px-4 text-right text-slate-900">
                          {p.delivered}/{p.sent}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-800">
                          {p.deliveryRatePct}%
                        </td>
                        <td className="py-3 px-6 text-right text-slate-600">
                          {p.duplicatesPrevented}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
