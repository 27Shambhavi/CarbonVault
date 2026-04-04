# credits_module/shadow_engine.py

class ShadowEngine:

    MATURITY_MULTIPLIERS = [0.5, 0.6, 0.7, 0.85, 1.0]

    def calculate_shadow_credits(
        self,
        annual_total_carbon: float,
        survival_probability: float,
        confidence_score: float,
        year: int
    ) -> float:

        maturity = self.MATURITY_MULTIPLIERS[year]
        risk_buffer = 1 - (0.1 * (1 - confidence_score))

        shadow = (
            annual_total_carbon *
            survival_probability *
            risk_buffer *
            maturity
        )

        return round(shadow, 2)