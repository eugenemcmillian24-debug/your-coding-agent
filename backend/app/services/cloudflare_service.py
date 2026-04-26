import os
import hashlib
import httpx
import logging

logger = logging.getLogger("forge_agent.cloudflare")

CF_API = "https://api.cloudflare.com/client/v4"


def auth_headers(content_type: str = "application/json") -> dict:
    h = {"Authorization": f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN', '')}"}
    if content_type:
        h["Content-Type"] = content_type
    return h


def account_id() -> str:
    return os.getenv("CLOUDFLARE_ACCOUNT_ID", "")


async def create_pages_project(project_name: str, production_branch: str = "main") -> dict:
    """Create a Cloudflare Pages project (or confirm it already exists)."""
    payload = {
        "name": project_name,
        "production_branch": production_branch,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{CF_API}/accounts/{account_id()}/pages/projects",
            headers=auth_headers(),
            json=payload,
        )
        logger.info("Create Pages project %s: %s", project_name, r.status_code)
        return {"status_code": r.status_code, "data": r.json()}


async def deploy_files(project_name: str, files: list[dict]) -> dict:
    """Deploy files to Cloudflare Pages using the direct upload API.
    
    files: list of {"path": "index.html", "content": "<html>..."}
    """
    # Step 1: compute content hashes for manifest
    file_map = {}  # hash -> (path, content_bytes)
    manifest = {}  # path -> hash
    
    for f in files:
        content_bytes = f["content"].encode("utf-8") if isinstance(f["content"], str) else f["content"]
        content_hash = hashlib.sha256(content_bytes).hexdigest()
        file_map[content_hash] = (f["path"], content_bytes)
        # Cloudflare manifest uses / prefix
        path = f["path"] if f["path"].startswith("/") else f"/{f['path']}"
        manifest[path] = content_hash

    async with httpx.AsyncClient(timeout=120) as client:
        # Step 2: upload files
        upload_results = []
        for file_hash, (path, content_bytes) in file_map.items():
            r = await client.post(
                f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}/file",
                headers={"Authorization": f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN', '')}"},
                content=content_bytes,
            )
            upload_results.append({"path": path, "hash": file_hash, "status": r.status_code})
            logger.info("Uploaded %s (hash %s): %s", path, file_hash[:12], r.status_code)

        # Step 3: create deployment with manifest
        r = await client.post(
            f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}/deployments",
            headers=auth_headers(),
            json={"manifest": manifest},
        )
        logger.info("Create deployment for %s: %s", project_name, r.status_code)
        return {
            "status_code": r.status_code,
            "data": r.json(),
            "upload_results": upload_results,
        }


async def create_deployment(project_name: str, branch: str = "main", files: list[dict] | None = None) -> dict:
    """Trigger a deployment. If files are provided, uses direct upload. Otherwise tries branch deploy."""
    if files:
        return await deploy_files(project_name, files)
    
    # Fallback: try branch deploy (only works with Git-connected projects)
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}/deployments",
            headers=auth_headers(),
            json={"branch": branch},
        )
        logger.info("Create deployment for %s: %s", project_name, r.status_code)
        return {"status_code": r.status_code, "data": r.json()}


async def get_deployment(project_name: str, deployment_id: str) -> dict:
    """Get deployment status."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}/deployments/{deployment_id}",
            headers=auth_headers(),
        )
        return {"status_code": r.status_code, "data": r.json()}


async def set_env_vars(project_name: str, env_vars: dict, target: str = "production") -> dict:
    """Set environment variables on a Pages project."""
    payload = {
        "deployment_configs": {
            target: {
                "env_vars": {k: {"value": v, "type": "plain_text"} for k, v in env_vars.items()}
            }
        }
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.patch(
            f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}",
            headers=auth_headers(),
            json=payload,
        )
        logger.info("Set env vars for %s (%s): %s", project_name, target, r.status_code)
        return {"status_code": r.status_code, "data": r.json()}


async def list_deployments(project_name: str) -> dict:
    """List recent deployments for a project."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{CF_API}/accounts/{account_id()}/pages/projects/{project_name}/deployments",
            headers=auth_headers(),
        )
        return {"status_code": r.status_code, "data": r.json()}
