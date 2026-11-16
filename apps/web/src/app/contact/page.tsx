'use client';

import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [subject, setSubject] = useState('Registry Verification Inquiry');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, organization, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      setStatusMsg({
        ok: true,
        text: `Inquiry logged (Reference: ${data.id.slice(0, 8)}). The Lagos Pilot Registry Desk will follow up via email.`,
      });
      setName('');
      setEmail('');
      setOrganization('');
      setMessage('');
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Unable to submit inquiry',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-slate-900">Contact Registry Desk</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Reach the ANAGU Lands Administration & Technical Integration Office for cadastral pilot inquiries, surveyor onboarding, or statutory audit requests.
            </p>
            <dl className="mt-6 space-y-4 text-sm border-t border-slate-100 pt-4">
              <div>
                <dt className="text-xs text-slate-500">Pilot Registry Office</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  Block 14, Lands Bureau Secretariat, Alausa, Ikeja, Lagos
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Office Hours</dt>
                <dd className="font-mono text-xs text-slate-900 mt-0.5">
                  Mon – Fri · 08:00 – 16:00 WAT
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Technical Desk</dt>
                <dd className="font-mono text-xs text-slate-900 mt-0.5">
                  registry-support@anagu.gov.ng
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Submit an Inquiry</h2>
          {statusMsg && (
            <div
              className={`mb-4 p-3 rounded-md border text-sm ${
                statusMsg.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Adewale Balogun"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Organization (Optional)</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Lagos Survey Practice"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option>Registry Verification Inquiry</option>
                  <option>Surveyor Accreditation</option>
                  <option>Statutory Revocation Audit</option>
                  <option>Technical Integration</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="Describe your parcel reference or registry question..."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Send Inquiry'}
            </button>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
