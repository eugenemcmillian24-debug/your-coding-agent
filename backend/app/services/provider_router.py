import os, json, httpx

def _provider_config(provider: str):
    provider = (provider or os.getenv('DEFAULT_PROVIDER', 'opencode-go')).lower()
    base = os.getenv('OPENCODE_BASE_URL', '').rstrip('/')
    key = os.getenv('OPENCODE_API_KEY')
    small_model = os.getenv('OPENCODE_SMALL_MODEL', '')
    if provider == 'opencode-zen':
        return {'provider': 'opencode-zen', 'model': os.getenv('OPENCODE_ZEN_MODEL', ''), 'small_model': small_model, 'base_url': base, 'api_key': key}
    return {'provider': 'opencode-go', 'model': os.getenv('OPENCODE_GO_MODEL', ''), 'small_model': small_model, 'base_url': base, 'api_key': key}

async def generate_text(provider: str, system_prompt: str, user_prompt: str, use_small: bool = False) -> str:
    cfg = _provider_config(provider)
    selected_model = cfg['small_model'] if use_small and cfg['small_model'] else cfg['model']
    if not cfg['api_key'] or not cfg['base_url'] or not selected_model:
        return f"[mock-{cfg['provider']}]\nMODEL={selected_model or 'unset'}\nSYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}"
    payload = {'model': selected_model, 'input': [{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': user_prompt}]}
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(f"{cfg['base_url']}/responses", headers={'Authorization': f"Bearer {cfg['api_key']}", 'Content-Type': 'application/json'}, json=payload)
        data = r.json()
        return data.get('output_text', json.dumps(data))
