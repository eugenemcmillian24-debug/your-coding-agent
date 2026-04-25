import os, base64, httpx
GITHUB_API = 'https://api.github.com'
def headers():
    token = os.getenv('GITHUB_TOKEN', '')
    return {'Accept': 'application/vnd.github+json', 'Authorization': f'Bearer {token}', 'X-GitHub-Api-Version': '2026-03-10'}
async def create_repo(repo_name):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f'{GITHUB_API}/user/repos', headers=headers(), json={'name': repo_name, 'private': False})
        return {'status_code': r.status_code, 'data': r.json()}
async def get_default_branch_sha(owner, repo):
    async with httpx.AsyncClient(timeout=30) as client:
        repo_resp = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}', headers=headers())
        repo_data = repo_resp.json()
        branch = repo_data.get('default_branch', 'main')
        ref_resp = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}', headers=headers())
        ref_data = ref_resp.json()
        return branch, ref_data.get('object', {}).get('sha')
async def create_branch(repo, branch_name):
    owner = os.getenv('GITHUB_OWNER', '')
    base_branch, sha = await get_default_branch_sha(owner, repo)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f'{GITHUB_API}/repos/{owner}/{repo}/git/refs', headers=headers(), json={'ref': f'refs/heads/{branch_name}', 'sha': sha})
        return {'status_code': r.status_code, 'base_branch': base_branch, 'data': r.json()}
async def put_file(repo, branch_name, path, content, message):
    owner = os.getenv('GITHUB_OWNER', '')
    encoded = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(f'{GITHUB_API}/repos/{owner}/{repo}/contents/{path}', headers=headers(), json={'message': message, 'content': encoded, 'branch': branch_name})
        return {'status_code': r.status_code, 'data': r.json()}
async def push_files(repo, branch_name, files):
    results = []
    for f in files:
        results.append(await put_file(repo, branch_name, f['path'], f['content'], f"Add {f['path']}"))
    return results
async def create_pr(repo, branch_name, base_branch, title, body):
    owner = os.getenv('GITHUB_OWNER', '')
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f'{GITHUB_API}/repos/{owner}/{repo}/pulls', headers=headers(), json={'title': title, 'head': branch_name, 'base': base_branch, 'body': body})
        return {'status_code': r.status_code, 'data': r.json()}
async def list_reviews(repo, pull_number):
    owner = os.getenv('GITHUB_OWNER', '')
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f'{GITHUB_API}/repos/{owner}/{repo}/pulls/{pull_number}/reviews', headers=headers())
        return {'status_code': r.status_code, 'data': r.json()}
