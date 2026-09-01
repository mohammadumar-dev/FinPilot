from pydantic import BaseModel


class InsightsOverview(BaseModel):
    total_orders: int
    paid_orders: int
    pending_orders: int
    failed_orders: int
    total_revenue_paise: int


class InsightsTrendPoint(BaseModel):
    date: str
    orders: int
    revenue_paise: int


class PeriodStats(BaseModel):
    orders: int
    revenue_paise: int


class CampaignImpact(BaseModel):
    campaign_id: str
    status: str
    product_names: list[str]
    applied_at: str
    window_days: int
    before: PeriodStats
    after: PeriodStats


class AdImpact(BaseModel):
    ad_campaign_id: str
    product_name: str
    status: str
    created_at: str
    impressions: int
    clicks: int
    spend_paise: int
    orders_since: int
    revenue_since_paise: int


class MerchantInsightsResponse(BaseModel):
    overview: InsightsOverview
    trend: list[InsightsTrendPoint]
    campaign_impacts: list[CampaignImpact]
    ad_impacts: list[AdImpact]
