import os
import httpx
import logging

logger = logging.getLogger("forge_agent.cloudflare")

CF_API = "https://api.cloudflare.com/client/v4"


def auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN', '')}",
        "Content-Type": "application/json",
    }


def account_id() -> str:
    return os.getenv("CLOUDFLARE_ACCOUNT_ID", "")


async def create_pages_project(project_name: str, production_branch: str = "main") -> dict:
    """Create a Cloudflare Pages project."""
    payload = {
        "name": project_name,
        "production_branch": production_branch,
        "build_config": {
            "build_command": "npm run build",
            "destination_dir": "out",
            "root_dir": "",
        },
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{CF_API}/accounts/{account_id()}/pages/projects",
            headers=auth_headers(),
            json=payload,
        )
        logger.info("Create Pages project %s: %s", project_name, r.status_code)
        return {"status_code": r.status_code, "data": r.json()}


async def create_deployment(project_name: str, branch: str = "main") -> dict:
    """Trigger a Cloudflare Pages deployment via direct upload or Git integration."""
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
                "env_vars": {k: {"value": v} for k, v in env_vars.items()}
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
