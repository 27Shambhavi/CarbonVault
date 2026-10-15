import { useState, useEffect } from 'react';
import { T, Button, Badge, Modal } from '../UI.jsx';
import {
  fetchPayoutsLedger, processPaymentRefund, createPayout, getPayoutsExportUrl, fetchTransactions
} from '../../services/api.js';
import {
  DollarSign, RotateCcw, Download, CheckCircle, Clock, AlertCircle, Plus, Send, ArrowDownRight
} from 'lucide-react';

export function AdminRefundPayouts() {
  const [activeTab, setActiveTab] = useState('refunds'); // 'refunds' | 'payouts'
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refundModal, setRefundModal] = useState(null);
  const [refundReason, setRefundReason] = useState('Buyer cancellation request');
  const [refundLoading, setRefundLoading] = useState(false);
  const [createPayoutModal, setCreatePayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    ngo_id: 1,
    amount_inr: 50000,
    bank_account_last4: '4321',
    ifsc_code: 'HDFC0001234',
    reference_note: 'Settlement for verified carbon credits',
  });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setMsg(null);
    try {
      if (activeTab === 'refunds') {
        const res = await fetchTransactions('all');
        const list = Array.isArray(res.data) ? res.data : (res.data?.transactions || []);
        setTransactions(list);
      } else {
        const res = await fetchPayoutsLedger();
        const list = Array.isArray(res.data) ? res.data : [];
        setPayouts(list);
      }
    } catch {
      // Data load fallback
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRefund = async () => {
    if (!refundModal) return;
    setRefundLoading(true);
    try {
      await processPaymentRefund(refundModal.id, refundReason);
      setMsg({ type: 'success', text: `Transaction #${refundModal.id} successfully refunded! Credits and corporate wallet balances reversed.` });
      setRefundModal(null);
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: `Refund failed: ${err.message}` });
    } finally {
      setRefundLoading(false);
    }
  };

  const handleCreatePayout = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPayout(
        payoutForm.ngo_id,
        payoutForm.amount_inr,
        payoutForm.bank_account_last4,
        payoutForm.ifsc_code,
        payoutForm.reference_note
      );
      setMsg({ type: 'success', text: `Payout of ₹${payoutForm.amount_inr.toLocaleString('en-IN')} queued for settlement.` });
      setCreatePayoutModal(false);
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: `Failed to create payout: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, marginTop: 20 }}>
      {/* Tab selection */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, paddingBottom: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setActiveTab('refunds')}
            style={{
              background: activeTab === 'refunds' ? 'rgba(45,212,191,0.12)' : 'transparent',
              border: `1px solid ${activeTab === 'refunds' ? T.teal : 'transparent'}`,
              borderRadius: 8, padding: '8px 16px', color: activeTab === 'refunds' ? T.tealL : T.t3,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <RotateCcw size={15} />
            <span>Transaction Refunds & Reversals</span>
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            style={{
              background: activeTab === 'payouts' ? 'rgba(45,212,191,0.12)' : 'transparent',
              border: `1px solid ${activeTab === 'payouts' ? T.teal : 'transparent'}`,
              borderRadius: 8, padding: '8px 16px', color: activeTab === 'payouts' ? T.tealL : T.t3,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <DollarSign size={15} />
            <span>NGO Payouts Settlement Ledger</span>
          </button>
        </div>

        {activeTab === 'payouts' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={getPayoutsExportUrl()}
              download="payouts_settlement.csv"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${T.border2}`, color: T.t1, fontSize: 12, fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Download size={13} color={T.tealL} />
              <span>Export Settlement CSV</span>
            </a>
            <Button size="sm" variant="primary" onClick={() => setCreatePayoutModal(true)}>
              <Plus size={13} style={{ marginRight: 4 }} /> Create Payout
            </Button>
          </div>
        )}
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12,
          background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'success' ? T.emerald : T.crimson}`,
          color: msg.type === 'success' ? T.emeraldL : T.crimsonL,
        }}>
          {msg.text}
        </div>
      )}

      {/* Refunds tab */}
      {activeTab === 'refunds' && (
        <div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 14 }}>
            Executing a refund reverses purchased credits in the corporate buyer&apos;s wallet, recalculates double-entry ledger balances, and logs an immutable audit trail event.
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: T.t3 }}>Loading transactions…</div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: T.t3 }}>No transactions found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.t3, textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Txn ID</th>
                    <th style={{ padding: '10px 12px' }}>Buyer Company</th>
                    <th style={{ padding: '10px 12px' }}>Credits (t)</th>
                    <th style={{ padding: '10px 12px' }}>Amount (INR)</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isRefunded = tx.status === 'refunded';
                    return (
                      <tr key={tx.id} style={{ borderBottom: `1px solid ${T.border}`, color: T.t1 }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: T.tealL }}>#{tx.id}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{tx.corporate_name || 'Corporate Buyer'}</td>
                        <td style={{ padding: '10px 12px' }}>{Number(tx.quantity || 0).toLocaleString()} t</td>
                        <td style={{ padding: '10px 12px' }}>₹{Number(tx.amount_inr || tx.amount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge type={isRefunded ? 'danger' : 'teal'} label={tx.status || 'success'} />
                        </td>
                        <td style={{ padding: '10px 12px', color: T.t3 }}>
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Recent'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isRefunded}
                            onClick={() => setRefundModal(tx)}
                          >
                            <RotateCcw size={12} style={{ marginRight: 4 }} />
                            {isRefunded ? 'Refunded' : 'Refund'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payouts tab */}
      {activeTab === 'payouts' && (
        <div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 14 }}>
            Direct settlements to restoration NGOs. Generates bank-compliant wire transfer batches with IFSC routing.
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: T.t3 }}>Loading payouts ledger…</div>
          ) : payouts.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: T.t3 }}>No payout records recorded yet. Click &quot;Create Payout&quot; to queue a settlement.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.t3, textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Payout ID</th>
                    <th style={{ padding: '10px 12px' }}>Beneficiary NGO</th>
                    <th style={{ padding: '10px 12px' }}>Bank Account</th>
                    <th style={{ padding: '10px 12px' }}>IFSC Code</th>
                    <th style={{ padding: '10px 12px' }}>Amount (INR)</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}`, color: T.t1 }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: T.tealL }}>{p.payout_id}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.ngo_name || 'Amazonia Reforestation'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>•••• {p.bank_account_last4 || '9876'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.ifsc_code || 'HDFC0001234'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: T.emeraldL }}>₹{Number(p.amount_inr || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge type={p.status === 'settled' ? 'teal' : 'gold'} label={p.status || 'pending'} />
                      </td>
                      <td style={{ padding: '10px 12px', color: T.t3 }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Today'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Refund confirmation modal */}
      {refundModal && (
        <Modal open={!!refundModal} onClose={() => setRefundModal(null)} title={`Process Refund: Transaction #${refundModal.id}`} width={480}>
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: `1px solid ${T.crimson}`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.crimsonL }}>Reversal Warning</div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>
                Refunding ₹{Number(refundModal.amount_inr || refundModal.amount || 0).toLocaleString('en-IN')} will debit {refundModal.quantity} credits from {refundModal.corporate_name}&apos;s wallet and record a permanent audit entry.
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Refund Reason
              </label>
              <select
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              >
                <option value="Corporate Buyer cancellation">Corporate Buyer cancellation</option>
                <option value="Duplicate transaction">Duplicate transaction</option>
                <option value="Project adjustment or audit finding">Project adjustment or audit finding</option>
                <option value="Administrative resolution">Administrative resolution</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setRefundModal(null)}>Cancel</Button>
              <Button variant="danger" disabled={refundLoading} onClick={handleExecuteRefund}>
                {refundLoading ? 'Processing…' : 'Confirm & Execute Refund'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create payout modal */}
      {createPayoutModal && (
        <Modal open={createPayoutModal} onClose={() => setCreatePayoutModal(false)} title="Queue NGO Settlement Payout" width={480}>
          <form onSubmit={handleCreatePayout} style={{ padding: '4px 0' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Payout Amount (INR) <span style={{ color: T.crimson }}>*</span>
              </label>
              <input
                type="number"
                min="1000"
                value={payoutForm.amount_inr}
                onChange={(e) => setPayoutForm({ ...payoutForm, amount_inr: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                  Bank Account (Last 4)
                </label>
                <input
                  type="text"
                  maxLength="4"
                  value={payoutForm.bank_account_last4}
                  onChange={(e) => setPayoutForm({ ...payoutForm, bank_account_last4: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                    color: T.t1, fontSize: 13, outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={payoutForm.ifsc_code}
                  onChange={(e) => setPayoutForm({ ...payoutForm, ifsc_code: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                    color: T.t1, fontSize: 13, outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Reference Note
              </label>
              <input
                type="text"
                value={payoutForm.reference_note}
                onChange={(e) => setPayoutForm({ ...payoutForm, reference_note: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" type="button" onClick={() => setCreatePayoutModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">
                <Send size={14} style={{ marginRight: 6 }} /> Queue Payout
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
