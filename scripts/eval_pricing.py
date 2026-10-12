"""
scripts/eval_pricing.py
Evaluates the CarbonVault Dynamic Pricing Engine across a spectrum of demand multipliers.
Prints the effective USD price matrix and elasticity curve for research paper presentation.
Formula:
  effective_usd = base_price * m_demand * m_supply * m_living
Clamped within [MIN_BOUND, MAX_BOUND] as enforced by the pricing engine.
"""

import sys
from pathlib import Path

# Add Backend to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "Backend"))

BASE_PRICE_USD = 28.50
DEFAULT_SUPPLY_MULT = 1.02
DEFAULT_LIVING_MULT = 1.05

MIN_PRICE_FLOOR = 10.0
MAX_PRICE_CEILING = 120.0


def calculate_effective_price(
    base: float,
    m_demand: float,
    m_supply: float = DEFAULT_SUPPLY_MULT,
    m_living: float = DEFAULT_LIVING_MULT
) -> float:
    raw = base * m_demand * m_supply * m_living
    return round(max(MIN_PRICE_FLOOR, min(MAX_PRICE_CEILING, raw)), 2)


def run_pricing_evaluation():
    print("=" * 86)
    print("CarbonVault Dynamic Pricing Sensitivity Analysis (Demand Multiplier Spectrum)")
    print("=" * 86)
    print(f"Parameters: Base Price = ${BASE_PRICE_USD:.2f} USD | Supply Mult = {DEFAULT_SUPPLY_MULT:.2f} | Living Mult = {DEFAULT_LIVING_MULT:.2f}\n")

    demand_multipliers = [0.50, 0.65, 0.80, 0.90, 1.00, 1.10, 1.25, 1.40, 1.60, 1.80, 2.00, 2.25, 2.50]

    print(f"{'Demand Mult':<13} | {'Supply Mult':<13} | {'Living Mult':<13} | {'Base (USD)':<12} | {'Effective (USD)':<16} | {'Market Regime':<15}")
    print("-" * 86)

    for d in demand_multipliers:
        price = calculate_effective_price(BASE_PRICE_USD, d)
        if d < 0.85:
            regime = "Depressed Demand"
        elif d <= 1.15:
            regime = "Equilibrium"
        elif d <= 1.70:
            regime = "High Demand"
        else:
            regime = "Severe Scarcity"

        print(f"{d:>10.2f}x   | {DEFAULT_SUPPLY_MULT:>10.2f}x   | {DEFAULT_LIVING_MULT:>10.2f}x   | ${BASE_PRICE_USD:>9.2f}  | ${price:>13.2f}   | {regime:<15}")

    print("=" * 86)
    print("\nSimulating Coupled Supply Contraction vs Scarcity Surge:")
    print("-" * 86)
    scenarios = [
        ("Surplus / Low Buyer Activity", 0.70, 0.85, 1.00),
        ("Standard Equilibrium", 1.00, 1.00, 1.05),
        ("Corporate ESG Compliance Surge", 1.45, 1.10, 1.08),
        ("Extreme Scarcity Shock", 2.20, 1.35, 1.12),
    ]
    print(f"{'Scenario':<34} | {'Demand':<8} | {'Supply':<8} | {'Living':<8} | {'Final Price (USD)':<18}")
    print("-" * 86)
    for name, d, s, l in scenarios:
        eff = calculate_effective_price(BASE_PRICE_USD, d, s, l)
        print(f"{name:<34} | {d:>6.2f}x | {s:>6.2f}x | {l:>6.2f}x | ${eff:>15.2f}")
    print("=" * 86 + "\n")


if __name__ == "__main__":
    run_pricing_evaluation()
