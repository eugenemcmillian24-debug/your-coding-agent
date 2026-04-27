import json
from app.services.workspace_service import (
    list_templates,
    get_template_files,
    parse_files_from_response,
    WORKSPACE_SYSTEM_PROMPT,
    WORKSPACE_REFINE_PROMPT,
    TEMPLATES,
)


def test_list_templates_returns_all():
    templates = list_templates()
    assert len(templates) == len(TEMPLATES)
    for t in templates:
        assert "id" in t
        assert "name" in t
        assert "description" in t
        assert "icon" in t


def test_get_template_files_valid():
    files = get_template_files("blank")
    assert files is not None
    assert "index.html" in files
    assert "style.css" in files
    assert "main.js" in files


def test_get_template_files_invalid():
    files = get_template_files("nonexistent-template")
    assert files is None


def test_parse_files_from_response_valid_json():
    response = json.dumps({
        "files": {
            "index.html": "<!DOCTYPE html><html></html>",
            "style.css": "body { color: red; }",
            "main.js": "console.log('hello');",
        }
    })
    files = parse_files_from_response(response)
    assert files is not None
    assert "index.html" in files
    assert "style.css" in files
    assert "main.js" in files


def test_parse_files_from_response_with_markdown_fences():
    response = "```json\n" + json.dumps({
        "files": {
            "index.html": "<html></html>",
        }
    }) + "\n```"
    files = parse_files_from_response(response)
    assert files is not None
    assert "index.html" in files


def test_parse_files_from_response_invalid():
    files = parse_files_from_response("This is not JSON at all")
    assert files is None


def test_parse_files_from_response_no_files_key():
    response = json.dumps({"something_else": "value"})
    files = parse_files_from_response(response)
    assert files is None


def test_all_templates_have_required_files():
    for tid, template in TEMPLATES.items():
        assert "index.html" in template["files"], f"Template {tid} missing index.html"
        assert "style.css" in template["files"], f"Template {tid} missing style.css"
        assert "main.js" in template["files"], f"Template {tid} missing main.js"


def test_system_prompt_exists():
    assert len(WORKSPACE_SYSTEM_PROMPT) > 50
    assert "JSON" in WORKSPACE_SYSTEM_PROMPT
    assert "files" in WORKSPACE_SYSTEM_PROMPT


def test_refine_prompt_has_placeholders():
    assert "{current_files}" in WORKSPACE_REFINE_PROMPT
    assert "{user_message}" in WORKSPACE_REFINE_PROMPT
