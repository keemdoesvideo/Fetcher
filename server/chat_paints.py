"""Best-effort 7TV username-paint enrichment for Twitch replay chat.

Finished Twitch VOD messages already carry the chatter's numeric Twitch id.
7TV exposes the active paint id for that connection through its public GraphQL
API. Fetcher resolves those ids in batches, resolves the paint definitions, and
attaches a small renderer-friendly ``user.paint`` object to matching messages.

Cosmetics are fidelity only: callers should always treat failures as soft and
fall back to Twitch's normal solid username colour.
"""

from __future__ import annotations

from collections import Counter
import json
import logging
import math
import threading
import time
import urllib.request

log = logging.getLogger("fetcher.chat.paints")

_GQL = "https://7tv.io/v3/gql"
_USER_TTL = 30 * 60
_PAINT_TTL = 6 * 60 * 60
_MAX_USER_LOOKUPS = 200
_USER_BATCH = 40
_PAINT_BATCH = 80

_lock = threading.Lock()
# twitch id -> (created monotonic, paint id or None)
_user_cache: dict[str, tuple[float, str | None]] = {}
# paint id -> (created monotonic, normalized paint or None)
_paint_cache: dict[str, tuple[float, dict | None]] = {}


def _post(query: str, variables: dict | None = None, *, allow_partial: bool = False) -> dict:
    body = json.dumps(
        {"query": query, "variables": variables or {}},
        separators=(",", ":"),
    ).encode("utf-8")
    req = urllib.request.Request(
        _GQL,
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Fetcher/0.2 (+https://fetcher.hahkeemi.com)",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        parsed = json.loads(response.read().decode("utf-8", "replace"))
    if not isinstance(parsed, dict):
        raise ValueError("7TV returned an invalid response")
    data = parsed.get("data")
    if parsed.get("errors") and not allow_partial:
        raise ValueError("7TV GraphQL rejected the cosmetics lookup")
    if not isinstance(data, dict):
        if parsed.get("errors"):
            raise ValueError("7TV GraphQL returned no usable cosmetics data")
        return {}
    return data


def _chunks(values: list[str], size: int):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def _valid_twitch_id(value: object) -> str:
    raw = str(value or "").strip()
    return raw if raw.isdigit() and len(raw) <= 32 else ""


def _cached_user(user_id: str):
    with _lock:
        item = _user_cache.get(user_id)
        if not item:
            return False, None
        created, paint_id = item
        if time.monotonic() - created > _USER_TTL:
            _user_cache.pop(user_id, None)
            return False, None
        return True, paint_id


def _put_user(user_id: str, paint_id: str | None) -> None:
    with _lock:
        _user_cache[user_id] = (time.monotonic(), paint_id or None)


def _cached_paint(paint_id: str):
    with _lock:
        item = _paint_cache.get(paint_id)
        if not item:
            return False, None
        created, paint = item
        if time.monotonic() - created > _PAINT_TTL:
            _paint_cache.pop(paint_id, None)
            return False, None
        return True, paint


def _put_paint(paint_id: str, paint: dict | None) -> None:
    with _lock:
        _paint_cache[paint_id] = (time.monotonic(), paint)


def _rgba(value: object) -> tuple[str, float] | None:
    try:
        raw = int(value) & 0xFFFFFFFF
    except (TypeError, ValueError, OverflowError):
        return None
    rgb = (raw >> 8) & 0xFFFFFF
    alpha = (raw & 0xFF) / 255.0
    return f"#{rgb:06X}", max(0.0, min(1.0, alpha))


def _normalise_stops(values) -> list[dict]:
    output = []
    if not isinstance(values, list):
        return output
    for item in values:
        if not isinstance(item, dict):
            continue
        converted = _rgba(item.get("color"))
        if not converted:
            continue
        try:
            at = float(item.get("at") or 0.0)
        except (TypeError, ValueError):
            at = 0.0
        if not math.isfinite(at):
            continue
        color, alpha = converted
        output.append({
            "at": max(0.0, min(1.0, at)),
            "color": color,
            "alpha": round(alpha, 4),
        })
    output.sort(key=lambda stop: stop["at"])
    return output[:16]


def _normalise_shadows(values) -> list[dict]:
    output = []
    if not isinstance(values, list):
        return output
    for item in values[:4]:
        if not isinstance(item, dict):
            continue
        converted = _rgba(item.get("color"))
        if not converted:
            continue
        color, alpha = converted
        try:
            x = float(item.get("x_offset") or 0.0)
            y = float(item.get("y_offset") or 0.0)
            radius = float(item.get("radius") or 0.0)
        except (TypeError, ValueError):
            continue
        if not all(math.isfinite(v) for v in (x, y, radius)):
            continue
        output.append({
            "x": max(-30.0, min(30.0, x)),
            "y": max(-30.0, min(30.0, y)),
            "radius": max(0.0, min(30.0, radius)),
            "color": color,
            "alpha": round(alpha, 4),
        })
    return output


def _normalise_paint(raw: dict) -> dict | None:
    paint_id = str(raw.get("id") or "").strip()
    if not paint_id:
        return None

    # Newer responses can expose a ``gradients`` array while older/current
    # clients still receive the same fields directly on the paint. Prefer the
    # first populated gradient, otherwise use the legacy top-level form.
    function = str(raw.get("function") or "").upper()
    angle = raw.get("angle")
    repeat = bool(raw.get("repeat"))
    shape = str(raw.get("shape") or "circle")
    stops = _normalise_stops(raw.get("stops"))
    gradients = raw.get("gradients") if isinstance(raw.get("gradients"), list) else []
    if gradients:
        gradient = next((g for g in gradients if isinstance(g, dict) and g.get("stops")), None)
        if gradient:
            function = str(gradient.get("function") or function).upper()
            angle = gradient.get("angle", angle)
            repeat = bool(gradient.get("repeat", repeat))
            shape = str(gradient.get("shape") or shape)
            stops = _normalise_stops(gradient.get("stops")) or stops

    solid = _rgba(raw.get("color"))
    solid_color = solid[0] if solid else ""
    solid_alpha = solid[1] if solid else 1.0

    if function == "LINEAR_GRADIENT" and stops:
        kind = "linear"
    elif function == "RADIAL_GRADIENT" and stops:
        kind = "radial"
    elif solid_color:
        # URL/image and unknown paints still have a representative colour in
        # most 7TV definitions. Using it is a deterministic export-safe fallback.
        kind = "solid"
    elif stops:
        kind = "solid"
        solid_color = stops[0]["color"]
        solid_alpha = float(stops[0].get("alpha", 1.0))
    else:
        return None

    try:
        angle_value = float(angle or 0.0)
    except (TypeError, ValueError):
        angle_value = 0.0
    if not math.isfinite(angle_value):
        angle_value = 0.0

    return {
        "id": paint_id,
        "name": str(raw.get("name") or "7TV paint")[:96],
        "kind": kind,
        "color": solid_color or (stops[0]["color"] if stops else "#FFFFFF"),
        "alpha": round(max(0.0, min(1.0, solid_alpha)), 4),
        "angle": angle_value % 360.0,
        "shape": shape[:32],
        "repeat": repeat,
        "stops": stops,
        "shadows": _normalise_shadows(raw.get("shadows")),
    }


def _fetch_user_ids(user_ids: list[str]) -> None:
    for batch in _chunks(user_ids, _USER_BATCH):
        fields = []
        for index, user_id in enumerate(batch):
            # Twitch ids were validated as digits, so interpolation cannot alter
            # the GraphQL document structure.
            fields.append(
                f'u{index}:userByConnection(id:"{user_id}",platform:TWITCH)'
                "{style{paint_id}}"
            )
        query = "query FetcherPaintUsers{" + " ".join(fields) + "}"
        try:
            # Many ordinary Twitch chatters do not have 7TV accounts. GraphQL can
            # report those aliases as errors while still returning valid siblings,
            # so keep the partial data instead of discarding the whole batch.
            data = _post(query, allow_partial=True)
        except Exception as exc:
            log.info("7TV user-paint batch unavailable: %s", exc)
            continue
        for index, user_id in enumerate(batch):
            user = data.get(f"u{index}")
            style = user.get("style") if isinstance(user, dict) and isinstance(user.get("style"), dict) else {}
            paint_id = str(style.get("paint_id") or "").strip() or None
            _put_user(user_id, paint_id)


def _fetch_paint_ids(paint_ids: list[str]) -> None:
    query = """query FetcherPaints($list:[ObjectID!]) {
      cosmetics(list:$list) {
        paints {
          id name function color angle shape repeat image_url
          stops { at color }
          shadows { x_offset y_offset radius color }
          gradients { function angle shape repeat stops { at color } }
        }
      }
    }"""
    for batch in _chunks(paint_ids, _PAINT_BATCH):
        try:
            data = _post(query, {"list": batch})
        except Exception as exc:
            # Some 7TV deployments historically exposed only the legacy
            # top-level gradient fields. Retry without ``gradients`` if schema
            # drift rejects the richer query.
            legacy = """query FetcherPaints($list:[ObjectID!]) {
              cosmetics(list:$list) {
                paints {
                  id name function color angle shape repeat image_url
                  stops { at color }
                  shadows { x_offset y_offset radius color }
                }
              }
            }"""
            try:
                data = _post(legacy, {"list": batch})
            except Exception as legacy_exc:
                log.info("7TV paint batch unavailable: %s / %s", exc, legacy_exc)
                continue

        cosmetics = data.get("cosmetics") if isinstance(data.get("cosmetics"), dict) else {}
        paints = cosmetics.get("paints") if isinstance(cosmetics.get("paints"), list) else []
        found: set[str] = set()
        for raw in paints:
            if not isinstance(raw, dict):
                continue
            paint_id = str(raw.get("id") or "").strip()
            if not paint_id:
                continue
            found.add(paint_id)
            _put_paint(paint_id, _normalise_paint(raw))
        for paint_id in batch:
            if paint_id not in found:
                _put_paint(paint_id, None)


def apply(payload: dict) -> dict:
    """Attach active 7TV name paints to replay messages, best-effort.

    To keep a public Fetcher instance polite to 7TV, uncached lookups are capped
    per capture and prioritized by chatter frequency. Cached identities outside
    that cap are still applied.
    """
    messages = [m for m in (payload.get("messages") or []) if isinstance(m, dict)]
    if not messages:
        payload["sevenTvPaints"] = 0
        return payload

    counts: Counter[str] = Counter()
    for message in messages:
        user = message.get("user") if isinstance(message.get("user"), dict) else {}
        user_id = _valid_twitch_id(user.get("id"))
        if user_id:
            counts[user_id] += 1
    if not counts:
        payload["sevenTvPaints"] = 0
        return payload

    user_to_paint: dict[str, str | None] = {}
    missing: list[str] = []
    for user_id, _count in counts.most_common():
        hit, paint_id = _cached_user(user_id)
        if hit:
            user_to_paint[user_id] = paint_id
        elif len(missing) < _MAX_USER_LOOKUPS:
            missing.append(user_id)

    if missing:
        _fetch_user_ids(missing)
        for user_id in missing:
            hit, paint_id = _cached_user(user_id)
            if hit:
                user_to_paint[user_id] = paint_id

    needed_paints = sorted({paint_id for paint_id in user_to_paint.values() if paint_id})
    unresolved = []
    paint_defs: dict[str, dict] = {}
    for paint_id in needed_paints:
        hit, paint = _cached_paint(paint_id)
        if hit:
            if isinstance(paint, dict):
                paint_defs[paint_id] = paint
        else:
            unresolved.append(paint_id)
    if unresolved:
        _fetch_paint_ids(unresolved)
        for paint_id in unresolved:
            hit, paint = _cached_paint(paint_id)
            if hit and isinstance(paint, dict):
                paint_defs[paint_id] = paint

    painted_messages = 0
    painted_users: set[str] = set()
    for message in messages:
        user = message.get("user") if isinstance(message.get("user"), dict) else None
        if user is None:
            continue
        user_id = _valid_twitch_id(user.get("id"))
        paint_id = user_to_paint.get(user_id) if user_id else None
        paint = paint_defs.get(paint_id or "")
        if not paint:
            continue
        user["paint"] = dict(paint)
        painted_messages += 1
        painted_users.add(user_id)

    payload["sevenTvPaints"] = painted_messages
    payload["sevenTvPaintUsers"] = len(painted_users)
    return payload
