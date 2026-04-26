import os, json, httpx, logging

logger = logging.getLogger("forge_agent.provider")

# ---------- Model catalog ----------
# Each model: (endpoint_type, base_url_key)
#   endpoint_type: "chat" = /chat/completions, "messages" = /messages
#   base_url_key: "zen" or "go" — determines which base URL and API key to use

MODEL_CATALOG = {
    # ---- Free models (Zen, no cost) ---- #
    "minimax-m2.5-free":     {"endpoint": "chat",     "plan": "free", "label": "MiniMax M2.5 Free"},
    "hy3-preview-free":      {"endpoint": "chat",     "plan": "free", "label": "Hy3 Preview Free"},
    "nemotron-3-super-free": {"endpoint": "chat",     "plan": "free", "label": "Nemotron 3 Super Free"},

    # ---- Go plan models (paid $10/mo) ---- #
    "kimi-k2.5":       {"endpoint": "chat",     "plan": "go", "label": "Kimi K2.5"},
    "kimi-k2.6":       {"endpoint": "chat",     "plan": "go", "label": "Kimi K2.6"},
    "glm-5":           {"endpoint": "chat",     "plan": "go", "label": "GLM-5"},
    "glm-5.1":         {"endpoint": "chat",     "plan": "go", "label": "GLM-5.1"},
    "mimo-v2-pro":     {"endpoint": "chat",     "plan": "go", "label": "MiMo-V2-Pro"},
    "mimo-v2-omni":    {"endpoint": "chat",     "plan": "go", "label": "MiMo-V2-Omni"},
    "mimo-v2.5-pro":   {"endpoint": "chat",     "plan": "go", "label": "MiMo-V2.5-Pro"},
    "mimo-v2.5":       {"endpoint": "chat",     "plan": "go", "label": "MiMo-V2.5"},
    "minimax-m2.5":    {"endpoint": "messages", "plan": "go", "label": "MiniMax M2.5"},
    "minimax-m2.7":    {"endpoint": "messages", "plan": "go", "label": "MiniMax M2.7"},
    "qwen3.5-plus":    {"endpoint": "chat",     "plan": "go", "label": "Qwen3.5 Plus"},
    "qwen3.6-plus":    {"endpoint": "chat",     "plan": "go", "label": "Qwen3.6 Plus"},
    "deepseek-v4-pro": {"endpoint": "messages", "plan": "go", "label": "DeepSeek V4 Pro"},
    "deepseek-v4-flash":{"endpoint": "messages","plan": "go", "label": "DeepSeek V4 Flash"},
}

# Base URLs per plan
BASE_URLS = {
    "free": "https://opencode.ai/zen/v1",
    "zen":  "https://opencode.ai/zen/v1",
    "go":   "https://opencode.ai/zen/go/v1",
}

# Default model priority: free first, paid Go for heavy lifting
DEFAULT_MODEL = os.getenv("OPENCODE_DEFAULT_MODEL", "nemotron-3-super-free")
FALLBACK_MODEL = os.getenv("OPENCODE_FALLBACK_MODEL", "kimi-k2.6")


def _get_api_key(plan: str) -> str:
    """Get API key based on plan type."""
    if plan == "free" or plan == "zen":
        return os.getenv("OPENCODE_ZEN_API_KEY") or os.getenv("OPENCODE_API_KEY", "")
    else:  # go
        return os.getenv("OPENCODE_GO_API_KEY") or os.getenv("OPENCODE_API_KEY", "")


def _resolve_model(model_id: str | None, use_heavy: bool = False) -> tuple[str, dict]:
    """Resolve model ID to catalog entry. Returns (model_id, catalog_entry)."""
    if model_id and model_id in MODEL_CATALOG:
        return model_id, MODEL_CATALOG[model_id]

    # Auto-select: heavy lifting uses paid Go model, default uses free
    selected = FALLBACK_MODEL if use_heavy else DEFAULT_MODEL
    if selected in MODEL_CATALOG:
        return selected, MODEL_CATALOG[selected]

    # Ultimate fallback
    return DEFAULT_MODEL, MODEL_CATALOG.get(DEFAULT_MODEL, {"endpoint": "chat", "plan": "free", "label": DEFAULT_MODEL})


async def _call_chat_completions(base_url: str, api_key: str, model: str,
                                  system_prompt: str, user_prompt: str) -> str:
    """Call OpenAI-compatible /chat/completions endpoint."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 16384,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        if "output_text" in data:
            return data["output_text"]
        logger.warning("Unexpected chat/completions response: %s", list(data.keys()))
        return json.dumps(data)


async def _call_messages(base_url: str, api_key: str, model: str,
                          system_prompt: str, user_prompt: str) -> str:
    """Call Anthropic-style /messages endpoint (DeepSeek V4, MiniMax paid)."""
    payload = {
        "model": model,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
        "max_tokens": 16384,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{base_url}/messages",
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
            },
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        content_blocks = data.get("content", [])
        if content_blocks:
            texts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
            if texts:
                return "\n".join(texts)
        if "completion" in data:
            return data["completion"]
        logger.warning("Unexpected messages response: %s", list(data.keys()))
        return json.dumps(data)


async def generate_text(
    provider: str = "",
    system_prompt: str = "",
    user_prompt: str = "",
    use_small: bool = False,
    use_heavy: bool = False,
    model_override: str | None = None,
) -> str:
    """Generate text using OpenCode API.

    Model selection priority:
    1. model_override (explicit per-job model choice from frontend)
    2. use_heavy=True → FALLBACK_MODEL (paid Go plan, e.g. kimi-k2.6)
    3. default → DEFAULT_MODEL (free model, e.g. nemotron-3-super-free)

    Auto-routes to the correct endpoint and API key based on model catalog.
    """
    model_id, catalog = _resolve_model(model_override, use_heavy=use_heavy)
    plan = catalog["plan"]
    endpoint = catalog["endpoint"]
    base_url = BASE_URLS.get(plan, BASE_URLS["go"])
    api_key = _get_api_key(plan)

    if not api_key:
        logger.warning("No API key for plan %s model %s — using mock", plan, model_id)
        return (
            f"[mock] MODEL={model_id} PLAN={plan}\n"
            f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}"
        )

    logger.info("Generating with model=%s plan=%s endpoint=%s", model_id, plan, endpoint)

    try:
        if endpoint == "messages":
            return await _call_messages(base_url, api_key, model_id, system_prompt, user_prompt)
        else:
            return await _call_chat_completions(base_url, api_key, model_id, system_prompt, user_prompt)
    except httpx.HTTPStatusError as e:
        logger.error("Model %s HTTP error %s: %s", model_id, e.response.status_code, e.response.text[:500])
        raise
    except Exception as e:
        logger.error("Model %s request failed: %s", model_id, e)
        raise


def list_available_models() -> list[dict]:
    """Return the full catalog for the frontend /api/models endpoint."""
    return [
        {
            "id": mid,
            "label": info["label"],
            "plan": info["plan"],
            "endpoint": info["endpoint"],
        }
        for mid, info in sorted(MODEL_CATALOG.items(), key=lambda x: (0 if x[1]["plan"] == "free" else 1, x[0]))
    ]
