"""Catalog search + ranking. The LLM never scores or invents products — this
module is the single source of truth for what's returned to the agent.

Search spans every merchant's catalog by default (a single chat can shop
shoes from one store and gadgets from another) — merchant_id is an optional
filter, not a scope. Each result carries merchant_id/merchant_name so the
buyer (and the agent's reply) can see which store a product comes from."""

import re
import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.merchant import Merchant
from app.models.product import Product


def _score(product: Product, min_price: int, max_price: int) -> float:
    """score = (rating/5)*0.6 + (1 - normalized_price)*0.4"""
    rating_component = (float(product.rating) / 5.0) * 0.6
    if max_price > min_price:
        normalized_price = (product.price_paise - min_price) / (max_price - min_price)
    else:
        normalized_price = 0.0
    price_component = (1 - normalized_price) * 0.4
    return round(rating_component + price_component, 4)


def _singular(word: str) -> str:
    # Cheap plural stripping, not a real stemmer — good enough so "book"
    # matches "Books" and vice versa without pulling in an NLP dependency.
    if len(word) > 3 and word.endswith("es") and word[:-2].isalpha():
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _word_boundary(word: str) -> str:
    # Postgres regex word boundary (\y), not the substring match ILIKE gives —
    # "mat" must match the whole word "mat", never a substring inside
    # "aromatherapy", "matte", "basmati", or "match". At catalog scale (130+
    # products across a dozen categories), those substring collisions are
    # common enough to bury the actual relevant result under noise.
    #
    # Matches the singular/plural form too ("book" <-> "books") — a plain
    # exact word-boundary match would otherwise miss "PageTurner Books" for
    # the query word "book", or miss a product literally named "Sneaker" for
    # the query word "sneakers".
    base = re.escape(_singular(word))
    return rf"\y{base}e?s?\y"


# Category values are a small controlled vocabulary of slugs ("smartphones",
# "car-accessories", "self-help"), not free text, so a substring test is both
# safe and more accurate there than the word-boundary match used on names and
# descriptions: \yphone\y never matched "smartphones", which is why searching
# "smart phone" surfaced a Car Phone *Mount* — its name has "Phone" as a whole
# word — while the actual phones scored nothing at all.
#
# A plain substring test is too loose in the other direction, though: "wall"
# (wall clock) is inside "wallets", and "table" is inside "tablets". The term
# has to line up with the *end* of a slug component — the head noun — which is
# what makes "smartphones" a phone and "laptops" a laptop, while leaving those
# prefix collisions out.
_CATEGORY_COMPOUND_MIN_LEN = 4


def _category_contains(category_text: str, singular_term: str) -> bool:
    for component in re.split(r"[^a-z0-9]+", category_text.lower()):
        if not component:
            continue
        if component in (singular_term, f"{singular_term}s", f"{singular_term}es"):
            return True
        # Compound head-noun match: "smartphones" ends with "phone(s)".
        if len(singular_term) >= _CATEGORY_COMPOUND_MIN_LEN and re.search(
            rf"{re.escape(singular_term)}e?s?$", component
        ):
            return True
    return False


def _matched_word_tiers(product: Product, merchant_name: str, terms: list[str]) -> tuple[int, int, int, int]:
    """(category_count, name_count, description_count, merchant_only_count).

    Four tiers, strongest first:
      1. category — the product's actual taxonomy classification. "laptop"
         matching the *category* "laptops" means this genuinely is a laptop.
         This must outrank a same-word match that's only in another
         product's name — e.g. "Laptop Backpack" (category "bags") is a
         laptop *accessory*, not a laptop, and must never outrank a real
         laptop just because it's cheaper and shares the word.
      2. name — still a real identity signal on its own ("shoes" matching
         the *name* "Running Shoes Pro" means this genuinely is a pair of
         shoes), but weaker than a category match since a name can borrow
         another product's word incidentally.
      3. description — real but weaker still: free text can mention a word
         incidentally (a duffel bag's description says "separate shoe
         compartment" — that doesn't make the duffel bag a shoe).
      4. merchant name only — weakest of all: the term just happens to
         overlap a store's brand name ("sport" matching "SprintZone
         Sports", "beauty" matching "GlowUp Beauty"), saying nothing about
         whether this particular product is what was asked for.

    Ranking by these tiers in order keeps an actual product match ahead of
    a same-category-word accessory, same-store, or same-description item
    that only incidentally shares a word, however cheap or well-rated it
    is."""
    category_text = (product.category or "").lower()
    name_text = (product.name or "").lower()
    description_text = (product.description or "").lower()
    merchant_text = (merchant_name or "").lower()
    tier_category = tier_name = tier_description = tier_merchant = 0
    for t in terms:
        singular = _singular(t.lower())
        pattern = rf"\b{re.escape(singular)}e?s?\b"
        if _category_contains(category_text, singular):
            tier_category += 1
        elif re.search(pattern, name_text):
            tier_name += 1
        elif re.search(pattern, description_text):
            tier_description += 1
        elif re.search(pattern, merchant_text):
            tier_merchant += 1
    return tier_category, tier_name, tier_description, tier_merchant


def search_catalog(
    db: Session,
    query: str,
    merchant_id: uuid.UUID | None = None,
    max_price_paise: int | None = None,
    category: str | None = None,
    limit: int = 5,
) -> list[dict]:
    q = (
        db.query(Product, Merchant.name)
        .join(Merchant, Merchant.id == Product.merchant_id)
        .filter(Product.is_active.is_(True))
    )

    if merchant_id is not None:
        q = q.filter(Product.merchant_id == merchant_id)
    if max_price_paise is not None:
        q = q.filter(Product.price_paise <= max_price_paise)

    # `category` is a soft hint, not a strict filter: the agent guesses category
    # names (e.g. "books") that don't necessarily match our actual category
    # values (e.g. "self-help") — a wrong guess must never exclude a real match.
    # So both `query` and `category` feed the same per-word OR match against
    # name/description/category, instead of category being a separate hard AND.
    #
    # Crucially the two are only pooled for *recall* (which rows are candidates),
    # never for *ranking*. Ranking on the pooled words let a plausible-but-wrong
    # category delete the right answer: "book on habits" + category="non-fiction"
    # scored "non"/"fiction" as category-tier hits for Thinking, Fast and Slow,
    # which set best_category_tier=2 and made the cutoff below drop Atomic Habits
    # — a self-help book, and the only real match — leaving the agent to tell the
    # buyer it isn't in the catalog at all. Tiers therefore come from the buyer's
    # own words only.
    query_words = [w for w in re.findall(r"\w+", query) if len(w) >= 3]
    category_words = [w for w in re.findall(r"\w+", category or "") if len(w) >= 3]

    # Match per word, not the whole phrase as one substring — "habits book"
    # should still find a product named "Atomic Habits" whose description
    # never contains that exact phrase. Short filler words (a, on, the, for,
    # …) are dropped so they don't dilute relevance.
    if not query_words and query.strip():
        query_words = [query.strip()]

    recall_terms = query_words + [w for w in category_words if w not in query_words]
    # Only the buyer's own words decide relevance tiers.
    search_terms: list[str] = query_words

    if recall_terms:
        word_clauses = [
            or_(
                Product.name.op("~*")(_word_boundary(w)),
                Product.description.op("~*")(_word_boundary(w)),
                # Mirrors _category_contains so recall and ranking agree.
                # Deliberately looser than _category_contains: recall may
                # over-include (ranking then decides), it must never under-include.
                Product.category.ilike(f"%{_singular(w.lower())}%"),
                Merchant.name.op("~*")(_word_boundary(w)),
            )
            for w in recall_terms
        ]
        q = q.filter(or_(*word_clauses))

    candidates = q.all()
    if not candidates:
        return []

    prices = [p.price_paise for p, _ in candidates]
    min_price, max_price = min(prices), max(prices)

    # Rank by relevance tier first (category > name > description > merchant
    # name — see _matched_word_tiers), then by the rating/price formula only
    # as the tiebreak within a tier.
    scored = [
        (p, merchant_name, *_matched_word_tiers(p, merchant_name, search_terms), _score(p, min_price, max_price))
        for p, merchant_name in candidates
    ]
    scored.sort(key=lambda t: (t[2], t[3], t[4], t[5], t[6]), reverse=True)

    # If a genuine category-taxonomy match exists (the buyer/agent's implied
    # category term — e.g. "smartphones" for "smart phone" — matches actual
    # product categories), cut off anything that ISN'T in that category, even
    # if it happens to match a weaker tier too. Without this, a category with
    # only 1-2 real members (e.g. only 2 phones exist) gets its remaining
    # `limit` slots backfilled with whatever else incidentally mentions the
    # same word — a car phone *mount*, a shirt described as "smart-casual" —
    # which is exactly the kind of padding-with-unrelated-products this
    # search is supposed to avoid. Only skip this cutoff when NOTHING matched
    # by category (best_category_tier == 0) — then the weaker tiers are all
    # we have, and returning them beats returning nothing.
    best_category_tier = scored[0][2] if scored else 0
    if best_category_tier > 0:
        scored = [t for t in scored if t[2] == best_category_tier]

    # Same principle one level down: within that category, a genuine name
    # match (e.g. "running" AND "shoes" both in "Men's Running Shoes Pro")
    # must cut off anything that only matched the category more generically
    # (a "Kids School Shoes" or "Women's Ballet Flats" is real footwear, but
    # isn't what "running shoes" asked for) — otherwise a specific style
    # request still gets padded out to `limit` with same-category siblings
    # that don't actually match the name the buyer used.
    best_name_tier = scored[0][3] if scored else 0
    if best_name_tier > 0:
        scored = [t for t in scored if t[3] == best_name_tier]

    return [
        {
            "product_id": str(p.id),
            "sku": p.sku,
            "name": p.name,
            "description": p.description,
            "price_paise": p.price_paise,
            "price_rupees": round(p.price_paise / 100, 2),
            "rating": float(p.rating),
            "category": p.category,
            "merchant_id": str(p.merchant_id),
            "merchant_name": merchant_name,
            "variant_group": p.variant_group,
            "variant_label": p.variant_label,
            "has_image": p.has_image,
            "score": score,
        }
        for p, merchant_name, _tier_cat, _tier_name, _tier_desc, _tier_merch, score in scored[:limit]
    ]


def list_categories(db: Session) -> list[str]:
    """Every distinct category value actually used in the catalog — handed to
    the agent as a closed enum for its `category` search parameter, so it
    picks a real taxonomy value (e.g. "fragrance") instead of a free-guessed
    word (e.g. "perfume" or "beauty") that doesn't exist anywhere in the data
    and can only ever match by accident (a merchant name overlap) or not at
    all."""
    rows = db.query(Product.category).distinct().order_by(Product.category).all()
    return [r[0] for r in rows]


def get_product_detail(db: Session, product_id: str) -> dict | None:
    try:
        pid = uuid.UUID(product_id)
    except ValueError:
        return None

    row = (
        db.query(Product, Merchant.name, Merchant.slug)
        .join(Merchant, Merchant.id == Product.merchant_id)
        .filter(Product.id == pid, Product.is_active.is_(True))
        .one_or_none()
    )
    if row is None:
        return None
    product, merchant_name, merchant_slug = row

    return {
        "product_id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "price_paise": product.price_paise,
        "price_rupees": round(product.price_paise / 100, 2),
        "rating": float(product.rating),
        "category": product.category,
        "attributes": product.attributes,
        "merchant_id": str(product.merchant_id),
        "merchant_name": merchant_name,
        "merchant_slug": merchant_slug,
        "variant_group": product.variant_group,
        "variant_label": product.variant_label,
        "has_image": product.has_image,
    }
