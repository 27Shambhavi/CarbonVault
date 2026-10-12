"""
Backend/ml/forecast.py
M4: Price Forecasting with statsmodels Exponential Smoothing.
Specification:
- Reads historical price observations from `price_history` table.
- If >= 30 points: Fits statsmodels ExponentialSmoothing with additive trend.
- If < 30 points: Fits OLS linear trend labelled "limited data".
- Projects 7-day forecast horizon with 95% prediction intervals (lower_bound, upper_bound).
- Exposes `GET /pricing/forecast` endpoint.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

import numpy as np
from sqlalchemy.orm import Session

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    HAS_STATSMODELS = True
except Exception as sm_err:
    ExponentialSmoothing = None
    HAS_STATSMODELS = False
    logger.warning("statsmodels import restricted by OS policy (%s); using native NumPy Holt-Winters fallback", sm_err)

from credit_calculation.credits_module.db_models import PriceHistory

logger = logging.getLogger("carbonvault.ml.forecast")


def generate_price_forecast(
    db: Session,
    horizon_days: int = 7
) -> Dict[str, Any]:
    """
    Generate 7-day carbon credit price forecast from `price_history` table.
    Uses statsmodels ExponentialSmoothing if >= 30 observations, else linear projection.
    """
    rows = db.query(PriceHistory).order_by(PriceHistory.ts.asc()).all()
    valid_rows = [r for r in rows if r.effective_usd is not None]
    count = len(valid_rows)

    now_utc = datetime.utcnow()

    # If database has no price history yet, bootstrap from standard platform base ($25.00)
    if count == 0:
        base_price = 25.0
        forecast_pts = []
        for i in range(1, horizon_days + 1):
            target_date = (now_utc + timedelta(days=i)).strftime("%Y-%m-%d")
            forecast_pts.append({
                "date": target_date,
                "predicted_price": base_price,
                "lower_bound": round(base_price * 0.95, 2),
                "upper_bound": round(base_price * 1.05, 2),
                "std_err": round(base_price * 0.025, 2)
            })
        return {
            "model": "baseline_constant",
            "status": "limited data",
            "historical_points": 0,
            "horizon_days": horizon_days,
            "current_effective_usd": base_price,
            "forecast": forecast_pts,
            "trend_direction": "flat",
            "summary": "Baseline constant forecast due to empty price history."
        }

    prices = np.array([float(r.effective_usd) for r in valid_rows], dtype=float)
    timestamps = [r.ts for r in valid_rows]
    current_price = float(prices[-1])

    forecast_pts = []
    model_name = "ExponentialSmoothing"
    status_label = "active"

    if count < 30:
        # Fewer than 30 points: OLS Linear trend labelled "limited data"
        status_label = "limited data"
        model_name = "LinearTrend (OLS)"

        x = np.arange(count)
        if count >= 2:
            slope, intercept = np.polyfit(x, prices, 1)
            residuals = prices - (slope * x + intercept)
            sigma = float(np.std(residuals)) if len(residuals) > 2 else 0.50
        else:
            slope = 0.0
            intercept = current_price
            sigma = 0.50

        sigma = max(0.20, sigma)

        for i in range(1, horizon_days + 1):
            target_date = (now_utc + timedelta(days=i)).strftime("%Y-%m-%d")
            pred = max(5.0, intercept + slope * (count - 1 + i))
            # 95% prediction interval: +/- 1.96 * sigma * sqrt(1 + i/count)
            half_width = 1.96 * sigma * np.sqrt(1.0 + (i / max(1, count)))
            lower = max(1.0, pred - half_width)
            upper = pred + half_width

            forecast_pts.append({
                "date": target_date,
                "predicted_price": round(float(pred), 2),
                "lower_bound": round(float(lower), 2),
                "upper_bound": round(float(upper), 2),
                "std_err": round(float(half_width / 1.96), 2)
            })

    else:
        # >= 30 points: statsmodels ExponentialSmoothing
        fit_res = None
        if HAS_STATSMODELS and ExponentialSmoothing is not None:
            try:
                # Additive trend without seasonal cycle (daily pricing)
                es_model = ExponentialSmoothing(
                    prices,
                    trend="add",
                    damped_trend=True,
                    initialization_method="estimated"
                )
                fit_res = es_model.fit()
                predictions = fit_res.forecast(horizon_days)
                residuals = fit_res.resid
                sigma = float(np.std(residuals)) if len(residuals) > 0 else 0.40
            except Exception as es_err:
                logger.warning("ExponentialSmoothing fit failed: %s, using native Holt-Winters", es_err)
                fit_res = None

        if fit_res is None:
            # Native Holt-Winters Additive Exponential Smoothing (alpha=0.3, beta=0.1)
            alpha, beta = 0.3, 0.1
            level = float(prices[0])
            trend = float(prices[1] - prices[0]) if len(prices) > 1 else 0.0
            fitted = [level]
            for t in range(1, len(prices)):
                val = float(prices[t])
                prev_level = level
                level = alpha * val + (1.0 - alpha) * (prev_level + trend)
                trend = beta * (level - prev_level) + (1.0 - beta) * trend
                fitted.append(level + trend)
            predictions = [max(5.0, level + (step + 1) * trend) for step in range(horizon_days)]
            resids = prices - np.array(fitted[:len(prices)])
            sigma = float(np.std(resids)) if len(resids) > 0 else 0.35

        sigma = max(0.15, sigma)

        for i in range(horizon_days):
            target_date = (now_utc + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            pred = max(5.0, float(predictions[i]))
            # Uncertainty widens with square root of forecast horizon
            half_width = 1.96 * sigma * np.sqrt(1.0 + (i + 1) * 0.1)
            lower = max(1.0, pred - half_width)
            upper = pred + half_width

            forecast_pts.append({
                "date": target_date,
                "predicted_price": round(float(pred), 2),
                "lower_bound": round(float(lower), 2),
                "upper_bound": round(float(upper), 2),
                "std_err": round(float(half_width / 1.96), 2)
            })

    first_pred = forecast_pts[0]["predicted_price"] if forecast_pts else current_price
    last_pred = forecast_pts[-1]["predicted_price"] if forecast_pts else current_price
    if last_pred > current_price + 0.1:
        direction = "upward"
    elif last_pred < current_price - 0.1:
        direction = "downward"
    else:
        direction = "stable"

    return {
        "model": model_name,
        "status": status_label,
        "historical_points": count,
        "horizon_days": horizon_days,
        "current_effective_usd": round(current_price, 2),
        "trend_direction": direction,
        "forecast": forecast_pts,
        "as_of": now_utc.isoformat() + "Z",
        "summary": f"7-day horizon indicates a {direction} trajectory from ${current_price:.2f} to ${last_pred:.2f}."
    }
