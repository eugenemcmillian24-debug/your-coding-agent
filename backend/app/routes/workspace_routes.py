import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services.workspace_service import (
    WORKSPACE_SYSTEM_PROMPT,
    WORKSPACE_REFINE_PROMPT,
    list_templates,
    get_template_files,
    create_workspace,
    get_workspace,
    list_workspaces,
    update_workspace_files,
    delete_workspace,
    stream_chat_completion,
    parse_files_from_response,
)
from ..services.subscription import check_subscription

logger = logging.getLogger("forge_agent.workspace_routes")

router = APIRouter()


class CreateWorkspaceRequest(BaseModel):
    email: str
    name: str
    template_id: str | None = None


class ChatRequest(BaseModel):
    email: str
    message: str
    model: str | None = None


class GenerateRequest(BaseModel):
    email: str
    prompt: str
    model: str | None = None


# ── Templates ──

@router.get("/templates")
def get_templates():
    return list_templates()


# ── Workspace CRUD ──

@router.post("/create")
def create_workspace_route(req: CreateWorkspaceRequest):
    sub = check_subscription(req.email)
    if not sub["subscribed"]:
        raise HTTPException(403, "Active subscription required")
    ws = create_workspace(req.email, req.name, req.template_id)
    return ws


@router.get("/list/{email}")
def list_workspaces_route(email: str):
    return list_workspaces(email)


@router.get("/{workspace_id}")
def get_workspace_route(workspace_id: str):
    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.delete("/{workspace_id}")
def delete_workspace_route(workspace_id: str):
    if not delete_workspace(workspace_id):
        raise HTTPException(404, "Workspace not found")
    return {"ok": True}


# ── AI Chat (streaming) ──

@router.post("/{workspace_id}/chat")
async def chat_stream(workspace_id: str, req: ChatRequest):
    sub = check_subscription(req.email)
    if not sub["subscribed"]:
        raise HTTPException(403, "Active subscription required")

    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")

    current_files = ws["files"]
    files_text = "\n".join(
        f"--- {fname} ---\n{content}" for fname, content in current_files.items()
    )

    refine_prompt = WORKSPACE_REFINE_PROMPT.format(
        current_files=files_text,
        user_message=req.message,
    )

    messages = [
        {"role": "system", "content": refine_prompt},
        {"role": "user", "content": req.message},
    ]

    full_response = []

    async def event_stream():
        async for token in stream_chat_completion(messages, req.model):
            full_response.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        full_text = "".join(full_response)
        files = parse_files_from_response(full_text)
        if files:
            update_workspace_files(
                workspace_id,
                files,
                chat_entry={"role": "user", "content": req.message},
            )
            yield f"data: {json.dumps({'type': 'files', 'files': files})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'text', 'content': full_text})}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Generate from scratch (streaming) ──

@router.post("/{workspace_id}/generate")
async def generate_stream(workspace_id: str, req: GenerateRequest):
    sub = check_subscription(req.email)
    if not sub["subscribed"]:
        raise HTTPException(403, "Active subscription required")

    ws = get_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")

    messages = [
        {"role": "system", "content": WORKSPACE_SYSTEM_PROMPT},
        {"role": "user", "content": req.prompt},
    ]

    full_response = []

    async def event_stream():
        async for token in stream_chat_completion(messages, req.model):
            full_response.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        full_text = "".join(full_response)
        files = parse_files_from_response(full_text)
        if files:
            update_workspace_files(
                workspace_id,
                files,
                chat_entry={"role": "user", "content": req.prompt},
            )
            yield f"data: {json.dumps({'type': 'files', 'files': files})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'text', 'content': full_text})}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
