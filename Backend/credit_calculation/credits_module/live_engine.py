# credits_module/live_engine.py
"""
Converts shadow credits to verified (live) credits.

Verification score is calculated from project's MRV, fraud, and env scores:
  verification = mrv * 0.4 + (100 - fraud_risk) * 0.3 + env * 0.3

Verified credits = shadow_credits × (verification_score / 100)
"""
from datetime import date, timedelta
import uuid


class LiveEngine:

    def convert_to_live(
        self,
        total_shadow_credits: float,
        verification_score: float
    ) -> dict:
        """
        Convert shadow credits to live verified credits.
        
        Args:
            total_shadow_credits: total projected shadow credits
            verification_score: calculated score (0-100), higher = more verified

        Returns dict with certificate_id, verified_credits, issuance_date, expiry_date.
        """
        # Clamp verification score to reasonable range
        vs = max(50, min(100, verification_score))

        # Verified credits = shadow × verification percentage
        verified = total_shadow_credits * (vs / 100)

        return {
            "certificate_id": f"LCC-{uuid.uuid4().hex[:10].upper()}",
            "verified_credits": round(verified, 2),
            "verification_score": round(vs, 2),
            "issuance_date": date.today(),
            "expiry_date": date.today() + timedelta(days=365 * 10)
        }