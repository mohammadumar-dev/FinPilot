# Import all model modules here so Alembic's autogenerate (and anything else
# that needs the full metadata) can discover them via Base.metadata just by
# importing this package.
from app.models.user import User, AccessToken, RefreshToken  # noqa: F401
from app.models.merchant import Merchant  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.agent_client import AgentClient  # noqa: F401
from app.models.conversation import Conversation, Message  # noqa: F401
from app.models.order import Order  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.cart_item import CartItem  # noqa: F401
from app.models.campaign import Campaign  # noqa: F401
from app.models.ad import AdWallet, AdWalletTopup, AdCampaign  # noqa: F401
