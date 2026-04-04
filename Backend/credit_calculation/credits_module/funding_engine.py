# credits_module/funding_engine.py
"""
Pricing engine for carbon credits.

Base price: $5 per credit ≈ ₹418 INR (Indian voluntary carbon market)
Ecosystem multipliers adjust price based on plantation value:
  - Mangrove: 1.4x (highest carbon + coastal protection)
  - Bamboo: 1.2x (fast-growing, high sequestration)
  - Teak: 1.3x (long-lived hardwood)
  - Banyan: 1.25x (heritage + longevity)
  - Neem: 1.15x (medicinal + environmental)
  - Eucalyptus: 1.1x (productive forestry)
  - Mixed: 1.1x (diversified)
  - Pine: 1.0x (baseline)

Price range: ₹418 - ₹585 per credit ($5 - $7 USD)
"""


class FundingEngine:

    # Ecosystem multipliers — match lowercase plantation_type values
    ECOSYSTEM_MULTIPLIERS = {
        "mangrove":    1.4,
        "bamboo":      1.2,
        "teak":        1.3,
        "banyan":      1.25,
        "neem":        1.15,
        "eucalyptus":  1.1,
        "mixed":       1.1,
        "pine":        1.0,
        # Legacy keys for backward compat
        "Mangrove":                   1.4,
        "Seagrass Meadow Restoration": 1.3,
        "Salt Marsh":                 1.2,
        "seagrass":                   1.3,
        "salt_marsh":                 1.2,
    }

    def calculate_funding(
        self,
        verified_credits: float,
        ecosystem_type: str,
        base_market_price: float = 12.0
    ) -> dict:
        """
        Calculate total funding value for verified credits.
        
        Args:
            verified_credits: number of verified carbon credits
            ecosystem_type: plantation type (used for multiplier lookup)
            base_market_price: base USD price per credit (default $12 ≈ ₹1000)
        
        Returns dict with price_per_ton, ecosystem_multiplier, total_funding,
               price_inr, total_funding_inr.
        """
        multiplier = self.ECOSYSTEM_MULTIPLIERS.get(
            ecosystem_type.lower().strip(),
            self.ECOSYSTEM_MULTIPLIERS.get(ecosystem_type, 1.0)
        )

        final_price_usd = base_market_price * multiplier
        total_value_usd = verified_credits * final_price_usd

        # INR conversion (approx ₹83.5 per USD)
        inr_rate = 83.5
        final_price_inr = final_price_usd * inr_rate
        total_value_inr = total_value_usd * inr_rate

        return {
            "price_per_ton": round(final_price_usd, 2),
            "price_per_ton_inr": round(final_price_inr, 2),
            "ecosystem_multiplier": multiplier,
            "total_funding": round(total_value_usd, 2),
            "total_funding_inr": round(total_value_inr, 2),
            "base_price_usd": base_market_price,
        }