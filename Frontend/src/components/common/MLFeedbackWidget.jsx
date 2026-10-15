import { useState } from 'react';
import { T } from '../UI.jsx';
import { submitMLFeedback } from '../../services/api.js';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

export function MLFeedbackWidget({ projectId, flagId, alertName = 'ML Risk Alert' }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVote = async (useful) => {
    if (loading || feedback !== null) return;
    setLoading(true);
    try {
      if (projectId && flagId) {
        await submitMLFeedback(projectId, flagId, useful);
      }
      setFeedback(useful);
    } catch {
      // Optimistic record
      setFeedback(useful);
    } finally {
      setLoading(false);
    }
  };

  if (feedback !== null) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.tealL, background: 'rgba(45,212,191,0.08)', padding: '3px 8px', borderRadius: 6 }}>
        <Check size={12} />
        <span>Feedback recorded ({feedback ? 'Useful' : 'Not useful'})</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.t3 }}>
      <span>Alert useful?</span>
      <button
        onClick={() => handleVote(true)}
        disabled={loading}
        title="Mark this ML alert as useful"
        style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
          borderRadius: 4, padding: '2px 6px', color: T.t2, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.teal; e.currentTarget.style.color = T.tealL; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}
      >
        <ThumbsUp size={11} /> Yes
      </button>
      <button
        onClick={() => handleVote(false)}
        disabled={loading}
        title="Mark this ML alert as false-positive or not useful"
        style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
          borderRadius: 4, padding: '2px 6px', color: T.t2, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.crimson; e.currentTarget.style.color = T.crimsonL; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}
      >
        <ThumbsDown size={11} /> No
      </button>
    </div>
  );
}
