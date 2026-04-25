import os, httpx
VERCEL_API = 'https://api.vercel.com'
def auth_headers():
    return {'Authorization': f"Bearer {os.getenv('VERCEL_TOKEN', '')}", 'Content-Type': 'application/json'}
def params():
    team_id = os.getenv('VERCEL_TEAM_ID', '')
    return {'teamId': team_id} if team_id else {}
async def create_project(name, repo=None):
    payload = {'name': name}
    if repo:
        payload['gitRepository'] = {'type': 'github', 'repo': repo}
        payload['framework'] = 'nextjs'
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f'{VERCEL_API}/v9/projects', params=params(), headers=auth_headers(), json=payload)
        return {'status_code': r.status_code, 'data': r.json()}
async def set_env(project_id_or_name, key, value, target='preview'):
    payload = {'key': key, 'value': value, 'target': [target], 'type': 'plain'}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f'{VERCEL_API}/v10/projects/{project_id_or_name}/env', params=params(), headers=auth_headers(), json=payload)
        return {'status_code': r.status_code, 'data': r.json()}
async def create_deployment(name, repo=None, repo_id=None, ref='main'):
    payload = {'name': name, 'projectSettings': {'framework': 'nextjs'}}
    if repo_id:
        payload['gitSource'] = {'type': 'github', 'repoId': repo_id, 'ref': ref}
    elif repo:
        payload['gitSource'] = {'type': 'github', 'repo': repo, 'ref': ref}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f'{VERCEL_API}/v13/deployments', params=params(), headers=auth_headers(), json=payload)
        return {'status_code': r.status_code, 'data': r.json()}
async def get_deployment(deployment_id):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f'{VERCEL_API}/v13/deployments/{deployment_id}', params=params(), headers=auth_headers())
        return {'status_code': r.status_code, 'data': r.json()}
