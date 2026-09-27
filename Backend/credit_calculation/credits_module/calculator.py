# credits_module/calculator.py
"""
Carbon credit calculator — computes shadow credits, verified credits,
and funding based on real CO₂ sequestration rates per plantation type.

Rates (tons CO₂/hectare/year — realistic Indian forestry):
  Bamboo: 5-12 | Eucalyptus: 3-8 | Teak: 2-5 | Neem: 1-3
  Mangrove: 5-12 | Pine: 3-6 | Banyan: 1-3 | Mixed: 4-10

1 Carbon Credit = 1 tonne CO₂ sequestered
Base price: $5 USD per credit (≈₹418 INR) — Indian voluntary market
"""
from .shadow_engine import ShadowEngine
from .live_engine import LiveEngine
from .funding_engine import FundingEngine
from .models import compute_co2_rate


class CreditCalculator:

    def __init__(self):
        self.shadow_engine = ShadowEngine()
        self.live_engine = LiveEngine()
        self.funding_engine = FundingEngine()

    def process_project_from_data(
        self,
        project_id: str,
        plantation_type: str,
        area_hectares: float,
        number_of_trees: int,
        mrv_score: float = 80.0,
        fraud_risk: float = 20.0,
        env_score: float = 80.0,
    ) -> dict:
        """
        Main entry point: calculate all credits for a project using
        real CO₂ sequestration rates.

        Args:
            project_id: unique project ID
            plantation_type: one of bamboo, eucalyptus, teak, neem, mangrove, pine, banyan, mixed
            area_hectares: project area in hectares
            number_of_trees: total trees planted
            mrv_score: MRV quality score (0-100)
            fraud_risk: fraud risk percentage (0-100)
            env_score: environmental score (0-100)

        Returns dict with all credit data.
        """
        # 1. Compute CO₂ absorption rate using plantation type + density
        co2_data = compute_co2_rate(plantation_type, area_hectares, number_of_trees)
        annual_credits = co2_data["annual_credits"]
        survival = co2_data["survival_probability"]
        confidence = co2_data["confidence_score"]
        lifespan = co2_data["expected_lifespan_years"]

        # 2. Calculate verification score from MRV, fraud, env scores
        #    Higher MRV + env = better; lower fraud = better
        verification_score = (
            mrv_score * 0.40 +
            (100 - fraud_risk) * 0.30 +
            env_score * 0.30
        )
        verification_score = max(50, min(100, verification_score))

        # 3. Lifetime carbon projection
        lifetime_carbon = annual_credits * lifespan

        # 4. Risk-adjusted lifetime carbon
        adjusted_lifetime_carbon = lifetime_carbon * survival * confidence

        # 5. Shadow credits (first 5 years)
        total_shadow = 0
        yearly_shadow = []
        for year in range(5):
            shadow = self.shadow_engine.calculate_shadow_credits(
                annual_credits,
                survival,
                confidence,
                year
            )
            total_shadow += shadow
            yearly_shadow.append({
                "year": year + 1,
                "shadow_credits": shadow
            })

        # 6. Convert to verified live credits using calculated verification score
        live_data = self.live_engine.convert_to_live(
            total_shadow,
            verification_score
        )

        # 7. Funding calculation with ecosystem-based pricing
        #    Base: ₹418 per credit ≈ $5 USD (Indian voluntary carbon market)
        base_market_price = 5.0  # USD per credit
        funding_data = self.funding_engine.calculate_funding(
            live_data["verified_credits"],
            plantation_type,
            base_market_price
        )

        return {
            "project_id": project_id,
            "plantation_type": plantation_type,

            # CO₂ calculation details
            "co2_per_hectare_per_year": co2_data["co2_per_hectare_per_year"],
            "area_hectares": area_hectares,
            "density_factor": co2_data["density_factor"],

            # Annual and lifetime
            "annual_credits": round(annual_credits, 2),
            "expected_lifespan_years": lifespan,
            "lifetime_carbon": round(lifetime_carbon, 2),
            "risk_adjusted_lifetime_carbon": round(adjusted_lifetime_carbon, 2),

            # Shadow credits (5-year projection)
            "shadow_credits_first_5_years": round(total_shadow, 2),
            "yearly_shadow_breakdown": yearly_shadow,

            # Verified credits
            "verification_score": round(verification_score, 2),
            "live_credit_data": live_data,

            # Funding / pricing
            "funding_data": funding_data,

            # Eco parameters used
            "survival_probability": survival,
            "confidence_score": confidence,
        }

    def process_project(
        self,
        ml_input,
        verification_score: float,
        market_price_per_ton: float
    ):
        """Legacy interface — kept for backward compatibility."""
        annual_total_carbon = (
            ml_input.co2_tons_per_acre_per_year *
            ml_input.area_hectares * 2.47105
        ) if ml_input.co2_tons_per_acre_per_year > 0 else (
            ml_input.area_hectares * 10  # fallback
        )

        lifetime_carbon = annual_total_carbon * ml_input.expected_lifespan_years
        adjusted_lifetime_carbon = (
            lifetime_carbon *
            ml_input.survival_probability *
            ml_input.confidence_score
        )

        total_shadow = 0
        yearly_shadow = []
        for year in range(5):
            shadow = self.shadow_engine.calculate_shadow_credits(
                annual_total_carbon,
                ml_input.survival_probability,
                ml_input.confidence_score,
                year
            )
            total_shadow += shadow
            yearly_shadow.append({"year": year, "shadow_credits": shadow})

        live_data = self.live_engine.convert_to_live(adjusted_lifetime_carbon, verification_score)
        funding_data = self.funding_engine.calculate_funding(
            live_data["verified_credits"],
            ml_input.plantation_type,
            market_price_per_ton
        )

        return {
            "project_id": ml_input.project_id,
            "annual_carbon": round(annual_total_carbon, 2),
            "expected_lifespan_years": ml_input.expected_lifespan_years,
            "lifetime_carbon": round(lifetime_carbon, 2),
            "risk_adjusted_lifetime_carbon": round(adjusted_lifetime_carbon, 2),
            "shadow_credits_first_5_years": round(total_shadow, 2),
            "yearly_shadow_breakdown": yearly_shadow,
            "live_credit_data": live_data,
            "funding_data": funding_data,
        }