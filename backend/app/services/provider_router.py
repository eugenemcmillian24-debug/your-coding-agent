import os, json, httpx, logging

logger = logging.getLogger("forge_agent.provider")


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


async def generate_text(
    provider: str, system_prompt: str, user_prompt: str, use_small: bool = False
) -> str:
    """Generate text using OpenCode Go API (OpenAI chat/completions compatible)."""
    cfg = _provider_config(provider)
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

    # OpenCode Go uses /chat/completions (OpenAI-compatible format)
    payload = {
        "model": selected_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 16384,
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{cfg['base_url']}/chat/completions",
                headers={
                    "Authorization": f"Bearer {cfg['api_key']}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            r.raise_for_status()
            data = r.json()

            # Standard OpenAI chat completion response
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")

            # Fallback: check for other response formats
            if "output_text" in data:
                return data["output_text"]

            logger.warning("Unexpected response format from %s: %s", cfg["provider"], list(data.keys()))
            return json.dumps(data)

    except httpx.HTTPStatusError as e:
        logger.error("Provider %s HTTP error: %s %s", cfg["provider"], e.response.status_code, e.response.text[:500])
        raise
    except Exception as e:
        logger.error("Provider %s request failed: %s", cfg["provider"], e)
        raise
