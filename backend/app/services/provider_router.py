import os, json, httpx, logging

logger = logging.getLogger("forge_agent.provider")

# Models that use the Anthropic-style /messages endpoint
MESSAGES_MODELS = frozenset({
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "minimax-m2.5",
    "minimax-m2.7",
})

# All other models use /chat/completions (OpenAI-compatible)
# kimi-k2.5, kimi-k2.6, glm-5, glm-5.1, mimo-v2-pro, mimo-v2-omni,
# mimo-v2.5-pro, mimo-v2.5, qwen3.5-plus, qwen3.6-plus

# Full model catalog for reference/validation
ALL_MODELS = frozenset({
    "kimi-k2.5", "kimi-k2.6",
    "glm-5", "glm-5.1",
    "mimo-v2-pro", "mimo-v2-omni", "mimo-v2.5-pro", "mimo-v2.5",
    "minimax-m2.5", "minimax-m2.7",
    "qwen3.5-plus", "qwen3.6-plus",
    "deepseek-v4-pro", "deepseek-v4-flash",
})


def _provider_config(provider: str):
    provider = (provider or os.getenv("DEFAULT_PROVIDER", "opencode-go")).lower()
    base = os.getenv("OPENCODE_BASE_URL", "").rstrip("/")
    small_model = os.getenv("OPENCODE_SMALL_MODEL", "")

    if provider == "opencode-zen":
        key = os.getenv("OPENCODE_ZEN_API_KEY") or os.getenv("OPENCODE_API_KEY")
        return {
            "provider": "opencode-zen",
            "model": os.getenv("OPENCODE_ZEN_MODEL", ""),
            "small_model": small_model,
            "base_url": base,
            "api_key": key,
        }

    key = os.getenv("OPENCODE_GO_API_KEY") or os.getenv("OPENCODE_API_KEY")
    return {
        "provider": "opencode-go",
        "model": os.getenv("OPENCODE_GO_MODEL", ""),
        "small_model": small_model,
        "base_url": base,
        "api_key": key,
    }


def _is_messages_model(model_id: str) -> bool:
    """Check if a model uses the /messages (Anthropic-style) endpoint."""
    return model_id.lower() in MESSAGES_MODELS


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
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
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
    """Call Anthropic-style /messages endpoint (used by DeepSeek V4, MiniMax)."""
    payload = {
        "model": model,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt},
        ],
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

        # Anthropic response format: {"content": [{"type": "text", "text": "..."}]}
        content_blocks = data.get("content", [])
        if content_blocks:
            texts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
            if texts:
                return "\n".join(texts)

        # Fallback
        if "completion" in data:
            return data["completion"]

        logger.warning("Unexpected messages response: %s", list(data.keys()))
        return json.dumps(data)


async def generate_text(
    provider: str, system_prompt: str, user_prompt: str,
    use_small: bool = False, model_override: str | None = None,
) -> str:
    """Generate text using OpenCode Go API.
    
    Automatically routes to the correct endpoint based on model:
    - /chat/completions for Kimi, GLM, MiMo, Qwen models
    - /messages for DeepSeek V4, MiniMax models
    
    Args:
        provider: Provider name (opencode-go or opencode-zen)
        system_prompt: System prompt
        user_prompt: User prompt  
        use_small: Use the small/cheap model
        model_override: Force a specific model ID (bypasses config)
    """
    cfg = _provider_config(provider)
    
    if model_override:
        selected_model = model_override
    else:
        selected_model = cfg["small_model"] if use_small and cfg["small_model"] else cfg["model"]

    if not cfg["api_key"] or not cfg["base_url"] or not selected_model:
        logger.warning(
            "Provider %s not fully configured (key=%s, base=%s, model=%s) — using mock",
            cfg["provider"],
            bool(cfg["api_key"]),
            bool(cfg["base_url"]),
            selected_model or "unset",
        )
        return (
            f"[mock-{cfg['provider']}]\n"
            f"MODEL={selected_model or 'unset'}\n"
            f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}"
        )

    try:
        if _is_messages_model(selected_model):
            logger.info("Using /messages endpoint for model %s", selected_model)
            return await _call_messages(
                cfg["base_url"], cfg["api_key"], selected_model,
                system_prompt, user_prompt,
            )
        else:
            logger.info("Using /chat/completions endpoint for model %s", selected_model)
            return await _call_chat_completions(
                cfg["base_url"], cfg["api_key"], selected_model,
                system_prompt, user_prompt,
            )

    except httpx.HTTPStatusError as e:
        logger.error(
            "Provider %s model %s HTTP error: %s %s",
            cfg["provider"], selected_model,
            e.response.status_code, e.response.text[:500],
        )
        raise
    except Exception as e:
        logger.error("Provider %s model %s request failed: %s", cfg["provider"], selected_model, e)
        raise


async def list_available_models() -> list[dict]:
    """Return the full catalog of available OpenCode Go models with metadata."""
    return [
        {"id": mid, "endpoint": "messages" if mid in MESSAGES_MODELS else "chat/completions"}
        for mid in sorted(ALL_MODELS)
    ]
