import json
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx

from .db import get_conn
from .provider_router import _resolve_model, _get_api_key, BASE_URLS, MODEL_CATALOG

logger = logging.getLogger("forge_agent.workspace")

# ── Templates ──

TEMPLATES: dict[str, dict] = {
    "blank": {
        "name": "Blank Project",
        "description": "Start from scratch with a minimal HTML page",
        "icon": "file",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="app">\n    <h1>Hello World</h1>\n  </div>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }\nh1 { font-size: 2.5rem; background: linear-gradient(135deg, #38bdf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }",
            "main.js": '// Your JavaScript here\nconsole.log("App loaded");',
        },
    },
    "landing-page": {
        "name": "Landing Page",
        "description": "Modern SaaS landing page with hero, features, and CTA sections",
        "icon": "layout",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>SaaS Landing</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <nav class="nav">\n    <div class="nav-brand">BrandName</div>\n    <div class="nav-links">\n      <a href="#features">Features</a>\n      <a href="#pricing">Pricing</a>\n      <a href="#" class="btn btn-sm">Get Started</a>\n    </div>\n  </nav>\n  <section class="hero">\n    <h1>Build faster with AI</h1>\n    <p>The modern platform for shipping products in hours, not weeks.</p>\n    <div class="hero-actions">\n      <a href="#" class="btn">Start Free Trial</a>\n      <a href="#" class="btn btn-outline">Watch Demo</a>\n    </div>\n  </section>\n  <section id="features" class="features">\n    <h2>Features</h2>\n    <div class="feature-grid">\n      <div class="feature-card"><h3>Lightning Fast</h3><p>Generate production-ready code in seconds.</p></div>\n      <div class="feature-card"><h3>AI Powered</h3><p>Backed by cutting-edge language models.</p></div>\n      <div class="feature-card"><h3>One-Click Deploy</h3><p>Deploy to the cloud with a single click.</p></div>\n    </div>\n  </section>\n  <footer class="footer"><p>&copy; 2026 BrandName. All rights reserved.</p></footer>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0f1a; color: #e2e8f0; }\n.nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; border-bottom: 1px solid #1e293b; }\n.nav-brand { font-size: 1.25rem; font-weight: 700; color: #38bdf8; }\n.nav-links { display: flex; gap: 24px; align-items: center; }\n.nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }\n.nav-links a:hover { color: #e2e8f0; }\n.btn { display: inline-block; padding: 12px 28px; border-radius: 8px; background: linear-gradient(135deg, #38bdf8, #2196f3); color: #fff; text-decoration: none; font-weight: 600; font-size: 0.95rem; }\n.btn-sm { padding: 8px 18px; font-size: 0.85rem; }\n.btn-outline { background: transparent; border: 1px solid #334155; color: #94a3b8; }\n.btn-outline:hover { border-color: #38bdf8; color: #38bdf8; }\n.hero { text-align: center; padding: 100px 40px 80px; }\n.hero h1 { font-size: 3.5rem; font-weight: 800; margin-bottom: 16px; background: linear-gradient(135deg, #f0f4f8, #38bdf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n.hero p { font-size: 1.2rem; color: #94a3b8; max-width: 500px; margin: 0 auto 32px; }\n.hero-actions { display: flex; gap: 16px; justify-content: center; }\n.features { padding: 80px 40px; text-align: center; }\n.features h2 { font-size: 2rem; margin-bottom: 40px; }\n.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; max-width: 900px; margin: 0 auto; }\n.feature-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 32px 24px; text-align: left; }\n.feature-card h3 { font-size: 1.1rem; margin-bottom: 8px; color: #38bdf8; }\n.feature-card p { font-size: 0.9rem; color: #94a3b8; }\n.footer { text-align: center; padding: 40px; border-top: 1px solid #1e293b; color: #64748b; font-size: 0.85rem; }",
            "main.js": '// Smooth scrolling\ndocument.querySelectorAll(\'a[href^="#"]\').forEach(a => {\n  a.addEventListener("click", e => {\n    e.preventDefault();\n    const target = document.querySelector(a.getAttribute("href"));\n    if (target) target.scrollIntoView({ behavior: "smooth" });\n  });\n});',
        },
    },
    "dashboard": {
        "name": "Admin Dashboard",
        "description": "Data dashboard with sidebar, stats cards, and chart placeholders",
        "icon": "grid",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Dashboard</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <aside class="sidebar">\n    <div class="sidebar-brand">Dashboard</div>\n    <nav>\n      <a href="#" class="nav-item active">Overview</a>\n      <a href="#" class="nav-item">Analytics</a>\n      <a href="#" class="nav-item">Users</a>\n      <a href="#" class="nav-item">Settings</a>\n    </nav>\n  </aside>\n  <main class="main">\n    <header class="topbar">\n      <h1>Overview</h1>\n      <div class="user-info">Admin User</div>\n    </header>\n    <div class="stats">\n      <div class="stat-card"><div class="stat-value">2,847</div><div class="stat-label">Total Users</div></div>\n      <div class="stat-card"><div class="stat-value">$12.4k</div><div class="stat-label">Revenue</div></div>\n      <div class="stat-card"><div class="stat-value">94.2%</div><div class="stat-label">Uptime</div></div>\n      <div class="stat-card"><div class="stat-value">1,023</div><div class="stat-label">Active Now</div></div>\n    </div>\n    <div class="chart-area">\n      <div class="chart-placeholder">Chart will render here</div>\n    </div>\n  </main>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0f1a; color: #e2e8f0; display: flex; min-height: 100vh; }\n.sidebar { width: 240px; background: #111827; border-right: 1px solid #1e293b; padding: 24px 16px; flex-shrink: 0; }\n.sidebar-brand { font-size: 1.25rem; font-weight: 700; color: #38bdf8; margin-bottom: 32px; padding: 0 8px; }\n.nav-item { display: block; padding: 10px 12px; border-radius: 8px; color: #94a3b8; text-decoration: none; font-size: 0.9rem; margin-bottom: 4px; }\n.nav-item:hover { background: #1e293b; color: #e2e8f0; }\n.nav-item.active { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }\n.main { flex: 1; padding: 24px 32px; overflow-y: auto; }\n.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }\n.topbar h1 { font-size: 1.5rem; font-weight: 700; }\n.user-info { color: #94a3b8; font-size: 0.9rem; }\n.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 32px; }\n.stat-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; }\n.stat-value { font-size: 1.8rem; font-weight: 700; color: #f0f4f8; }\n.stat-label { font-size: 0.85rem; color: #64748b; margin-top: 4px; }\n.chart-area { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; min-height: 300px; }\n.chart-placeholder { color: #475569; text-align: center; padding-top: 120px; }",
            "main.js": '// Dashboard interactivity\ndocument.querySelectorAll(".nav-item").forEach(item => {\n  item.addEventListener("click", e => {\n    e.preventDefault();\n    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));\n    item.classList.add("active");\n  });\n});',
        },
    },
    "todo-app": {
        "name": "Todo App",
        "description": "Interactive todo list with add, complete, and delete functionality",
        "icon": "check-square",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Todo App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="container">\n    <h1>Todo List</h1>\n    <form id="todo-form">\n      <input type="text" id="todo-input" placeholder="Add a new task..." autocomplete="off">\n      <button type="submit">Add</button>\n    </form>\n    <ul id="todo-list"></ul>\n    <div class="footer" id="footer" style="display:none">\n      <span id="count">0 items</span>\n      <button id="clear-done">Clear completed</button>\n    </div>\n  </div>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0f1a; color: #e2e8f0; display: flex; justify-content: center; padding-top: 80px; min-height: 100vh; }\n.container { width: 100%; max-width: 520px; }\nh1 { font-size: 2rem; margin-bottom: 24px; text-align: center; color: #38bdf8; }\n#todo-form { display: flex; gap: 8px; margin-bottom: 16px; }\n#todo-input { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid #1e293b; background: #111827; color: #e2e8f0; font-size: 0.95rem; outline: none; }\n#todo-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.15); }\n#todo-form button { padding: 12px 24px; border-radius: 8px; border: none; background: #38bdf8; color: #0f172a; font-weight: 600; cursor: pointer; }\n#todo-list { list-style: none; }\n#todo-list li { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #111827; border: 1px solid #1e293b; border-radius: 8px; margin-bottom: 8px; }\n#todo-list li.done span { text-decoration: line-through; color: #475569; }\n#todo-list li span { flex: 1; }\n#todo-list li button { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem; }\n.footer { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; color: #64748b; font-size: 0.85rem; }\n#clear-done { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; }',
            "main.js": 'const form = document.getElementById("todo-form");\nconst input = document.getElementById("todo-input");\nconst list = document.getElementById("todo-list");\nconst footer = document.getElementById("footer");\nconst countEl = document.getElementById("count");\nconst clearBtn = document.getElementById("clear-done");\n\nlet todos = JSON.parse(localStorage.getItem("todos") || "[]");\n\nfunction render() {\n  list.innerHTML = "";\n  todos.forEach((t, i) => {\n    const li = document.createElement("li");\n    if (t.done) li.classList.add("done");\n    li.innerHTML = `<input type="checkbox" ${t.done ? "checked" : ""}><span>${t.text}</span><button>&times;</button>`;\n    li.querySelector("input").onchange = () => { todos[i].done = !todos[i].done; save(); render(); };\n    li.querySelector("button").onclick = () => { todos.splice(i, 1); save(); render(); };\n    list.appendChild(li);\n  });\n  const active = todos.filter(t => !t.done).length;\n  countEl.textContent = `${active} item${active !== 1 ? "s" : ""} left`;\n  footer.style.display = todos.length ? "flex" : "none";\n}\n\nfunction save() { localStorage.setItem("todos", JSON.stringify(todos)); }\n\nform.onsubmit = e => { e.preventDefault(); const text = input.value.trim(); if (text) { todos.push({ text, done: false }); input.value = ""; save(); render(); } };\nclearBtn.onclick = () => { todos = todos.filter(t => !t.done); save(); render(); };\nrender();',
        },
    },
    "portfolio": {
        "name": "Portfolio",
        "description": "Personal portfolio with about, projects, and contact sections",
        "icon": "user",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Portfolio</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <nav class="nav">\n    <a href="#about">About</a>\n    <a href="#projects">Projects</a>\n    <a href="#contact">Contact</a>\n  </nav>\n  <section id="about" class="section hero">\n    <div class="avatar">JD</div>\n    <h1>Jane Developer</h1>\n    <p>Full-stack engineer passionate about building beautiful web experiences.</p>\n  </section>\n  <section id="projects" class="section">\n    <h2>Projects</h2>\n    <div class="project-grid">\n      <div class="project-card"><h3>Project Alpha</h3><p>A real-time data dashboard built with React and D3.</p><a href="#">View Project &rarr;</a></div>\n      <div class="project-card"><h3>Project Beta</h3><p>E-commerce platform with Stripe payments integration.</p><a href="#">View Project &rarr;</a></div>\n      <div class="project-card"><h3>Project Gamma</h3><p>AI-powered chatbot using LLMs and vector search.</p><a href="#">View Project &rarr;</a></div>\n    </div>\n  </section>\n  <section id="contact" class="section">\n    <h2>Get in Touch</h2>\n    <p>Reach me at <a href="mailto:jane@example.com">jane@example.com</a></p>\n  </section>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0f1a; color: #e2e8f0; }\n.nav { display: flex; justify-content: center; gap: 32px; padding: 20px; border-bottom: 1px solid #1e293b; position: sticky; top: 0; background: rgba(10,15,26,0.9); backdrop-filter: blur(8px); z-index: 10; }\n.nav a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }\n.nav a:hover { color: #38bdf8; }\n.section { max-width: 800px; margin: 0 auto; padding: 80px 24px; }\n.hero { text-align: center; padding-top: 120px; }\n.avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #38bdf8, #a78bfa); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; margin: 0 auto 24px; }\n.hero h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 12px; }\n.hero p { color: #94a3b8; font-size: 1.1rem; }\nh2 { font-size: 1.8rem; margin-bottom: 32px; }\n.project-grid { display: grid; gap: 20px; }\n.project-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; }\n.project-card h3 { color: #38bdf8; margin-bottom: 8px; }\n.project-card p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 12px; }\n.project-card a { color: #a78bfa; text-decoration: none; font-size: 0.9rem; }\n.project-card a:hover { text-decoration: underline; }\n#contact { text-align: center; }\n#contact a { color: #38bdf8; }',
            "main.js": '// Smooth scrolling\ndocument.querySelectorAll(\'.nav a\').forEach(a => {\n  a.addEventListener("click", e => {\n    e.preventDefault();\n    const target = document.querySelector(a.getAttribute("href"));\n    if (target) target.scrollIntoView({ behavior: "smooth" });\n  });\n});',
        },
    },
    "ecommerce": {
        "name": "E-Commerce Store",
        "description": "Product catalog with cart, checkout, and responsive layout",
        "icon": "shopping-cart",
        "files": {
            "index.html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Store</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <nav class="nav">\n    <div class="nav-brand">ShopName</div>\n    <div class="cart-icon" id="cart-toggle">Cart (<span id="cart-count">0</span>)</div>\n  </nav>\n  <main class="products" id="products"></main>\n  <aside class="cart-drawer" id="cart-drawer">\n    <h2>Shopping Cart</h2>\n    <div id="cart-items"></div>\n    <div class="cart-total">Total: $<span id="cart-total">0.00</span></div>\n    <button class="btn checkout-btn">Checkout</button>\n  </aside>\n  <script src="main.js"></script>\n</body>\n</html>',
            "style.css": '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; background: #0a0f1a; color: #e2e8f0; }\n.nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 1px solid #1e293b; position: sticky; top: 0; background: rgba(10,15,26,0.95); backdrop-filter: blur(8px); z-index: 10; }\n.nav-brand { font-size: 1.3rem; font-weight: 700; color: #38bdf8; }\n.cart-icon { cursor: pointer; color: #94a3b8; }\n.cart-icon:hover { color: #38bdf8; }\n.products { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; padding: 32px; max-width: 1200px; margin: 0 auto; }\n.product-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; transition: transform 0.2s; }\n.product-card:hover { transform: translateY(-4px); }\n.product-img { height: 200px; background: linear-gradient(135deg, #1e293b, #334155); display: flex; align-items: center; justify-content: center; font-size: 3rem; }\n.product-info { padding: 16px; }\n.product-info h3 { margin-bottom: 4px; }\n.product-price { color: #38bdf8; font-weight: 700; font-size: 1.2rem; margin-bottom: 12px; }\n.btn { padding: 10px 20px; border-radius: 8px; border: none; background: #38bdf8; color: #0f172a; font-weight: 600; cursor: pointer; width: 100%; }\n.btn:hover { background: #56ccff; }\n.cart-drawer { position: fixed; right: -360px; top: 0; width: 350px; height: 100vh; background: #111827; border-left: 1px solid #1e293b; padding: 24px; overflow-y: auto; transition: right 0.3s; z-index: 20; }\n.cart-drawer.open { right: 0; }\n.cart-drawer h2 { margin-bottom: 20px; }\n.cart-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #1e293b; font-size: 0.9rem; }\n.cart-total { font-size: 1.2rem; font-weight: 700; margin: 20px 0; color: #38bdf8; }\n.checkout-btn { background: #22c55e; }\n.checkout-btn:hover { background: #16a34a; }',
            "main.js": 'const products = [\n  { id: 1, name: "Wireless Headphones", price: 79.99, emoji: "🎧" },\n  { id: 2, name: "Mechanical Keyboard", price: 129.99, emoji: "⌨️" },\n  { id: 3, name: "4K Monitor", price: 349.99, emoji: "🖥️" },\n  { id: 4, name: "USB-C Hub", price: 49.99, emoji: "🔌" },\n  { id: 5, name: "Webcam Pro", price: 89.99, emoji: "📷" },\n  { id: 6, name: "Desk Lamp", price: 39.99, emoji: "💡" },\n];\n\nlet cart = [];\nconst productsEl = document.getElementById("products");\nconst cartDrawer = document.getElementById("cart-drawer");\nconst cartItems = document.getElementById("cart-items");\nconst cartCount = document.getElementById("cart-count");\nconst cartTotal = document.getElementById("cart-total");\n\nfunction renderProducts() {\n  productsEl.innerHTML = products.map(p => `\n    <div class="product-card">\n      <div class="product-img">${p.emoji}</div>\n      <div class="product-info">\n        <h3>${p.name}</h3>\n        <div class="product-price">$${p.price.toFixed(2)}</div>\n        <button class="btn" onclick="addToCart(${p.id})">Add to Cart</button>\n      </div>\n    </div>\n  `).join("");\n}\n\nfunction addToCart(id) {\n  const existing = cart.find(c => c.id === id);\n  if (existing) existing.qty++;\n  else cart.push({ ...products.find(p => p.id === id), qty: 1 });\n  renderCart();\n}\n\nfunction renderCart() {\n  cartItems.innerHTML = cart.map(c => `\n    <div class="cart-item"><span>${c.name} x${c.qty}</span><span>$${(c.price * c.qty).toFixed(2)}</span></div>\n  `).join("");\n  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);\n  cartTotal.textContent = total.toFixed(2);\n  cartCount.textContent = cart.reduce((s, c) => s + c.qty, 0);\n}\n\ndocument.getElementById("cart-toggle").onclick = () => cartDrawer.classList.toggle("open");\nrenderProducts();',
        },
    },
}

# ── AI system prompt for workspace code generation ──

WORKSPACE_SYSTEM_PROMPT = """You are an expert full-stack web developer AI. You generate complete, production-ready web applications.

When the user describes what they want to build, generate a multi-file project with HTML, CSS, and JavaScript.

IMPORTANT RULES:
1. Return ONLY a valid JSON object with a "files" key containing filename->content pairs
2. Always include: index.html, style.css, main.js at minimum
3. Use modern CSS (flexbox, grid, custom properties)
4. Use vanilla JavaScript (no frameworks/build tools needed)
5. Make the design professional, polished, dark-themed (background #0a0f1a)
6. Include responsive design
7. Add interactivity and animations where appropriate
8. No markdown fences — just the raw JSON

Example response format:
{
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "style.css": "* { ... }",
    "main.js": "// code..."
  }
}"""

WORKSPACE_REFINE_PROMPT = """You are an expert web developer AI. The user has an existing project and wants to modify it.

Below are the current project files:
{current_files}

The user wants the following change:
{user_message}

Return ONLY a valid JSON object with a "files" key containing the COMPLETE updated files.
Include ALL files (even unchanged ones) so the project stays complete.
Do NOT add markdown fences. Return raw JSON only.

{
  "files": {
    "index.html": "...",
    "style.css": "...",
    "main.js": "..."
  }
}"""


def list_templates() -> list[dict]:
    return [
        {"id": tid, "name": t["name"], "description": t["description"], "icon": t["icon"]}
        for tid, t in TEMPLATES.items()
    ]


def get_template_files(template_id: str) -> dict[str, str] | None:
    t = TEMPLATES.get(template_id)
    return t["files"] if t else None


# ── Database operations ──

def create_workspace(user_email: str, name: str, template_id: str | None = None) -> dict:
    workspace_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    files: dict[str, str] = {}
    if template_id and template_id in TEMPLATES:
        files = dict(TEMPLATES[template_id]["files"])
    else:
        files = dict(TEMPLATES["blank"]["files"])

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO workspaces (id, user_email, name, files, chat_history, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (workspace_id, user_email, name, json.dumps(files), json.dumps([]), now, now),
        )

    return {"id": workspace_id, "name": name, "files": files, "chat_history": [], "created_at": now}


def get_workspace(workspace_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, user_email, name, files, chat_history, created_at, updated_at FROM workspaces WHERE id = %s",
            (workspace_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "user_email": row["user_email"],
        "name": row["name"],
        "files": json.loads(row["files"]) if isinstance(row["files"], str) else row["files"],
        "chat_history": json.loads(row["chat_history"]) if isinstance(row["chat_history"], str) else row["chat_history"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_workspaces(user_email: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at, updated_at FROM workspaces WHERE user_email = %s ORDER BY updated_at DESC",
            (user_email,),
        ).fetchall()
    return [dict(r) for r in rows]


def update_workspace_files(workspace_id: str, files: dict[str, str], chat_entry: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        if chat_entry:
            workspace = get_workspace(workspace_id)
            if workspace:
                history = workspace["chat_history"]
                history.append(chat_entry)
                conn.execute(
                    "UPDATE workspaces SET files = %s, chat_history = %s, updated_at = %s WHERE id = %s",
                    (json.dumps(files), json.dumps(history), now, workspace_id),
                )
                return
        conn.execute(
            "UPDATE workspaces SET files = %s, updated_at = %s WHERE id = %s",
            (json.dumps(files), now, workspace_id),
        )


def delete_workspace(workspace_id: str) -> bool:
    with get_conn() as conn:
        result = conn.execute("DELETE FROM workspaces WHERE id = %s", (workspace_id,))
        return result.rowcount > 0


# ── Streaming AI generation ──

async def stream_chat_completion(
    messages: list[dict],
    model_id: str | None = None,
) -> AsyncIterator[str]:
    """Stream tokens from the AI model via SSE."""
    resolved_id, catalog = _resolve_model(model_id)
    plan = catalog["plan"]
    base_url = BASE_URLS.get(plan, BASE_URLS["go"])
    api_key = _get_api_key(plan)

    if not api_key:
        yield json.dumps({"type": "error", "content": "No API key configured"})
        return

    payload = {
        "model": resolved_id,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 16384,
        "stream": True,
    }

    endpoint = catalog.get("endpoint", "chat")
    if endpoint == "messages":
        # Anthropic-style: extract system from messages
        system_msg = ""
        user_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_msgs.append(m)
        payload = {
            "model": resolved_id,
            "system": system_msg,
            "messages": user_msgs,
            "max_tokens": 16384,
            "stream": True,
        }
        url = f"{base_url}/messages"
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }
    else:
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        if endpoint == "messages":
                            # Anthropic streaming format
                            if chunk.get("type") == "content_block_delta":
                                delta = chunk.get("delta", {})
                                text = delta.get("text", "")
                                if text:
                                    yield text
                        else:
                            # OpenAI streaming format
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                    except json.JSONDecodeError:
                        continue
    except httpx.HTTPStatusError as e:
        logger.error("Streaming HTTP error %s: %s", e.response.status_code, e.response.text[:300])
        yield json.dumps({"type": "error", "content": f"AI model error: {e.response.status_code}"})
    except Exception as e:
        logger.error("Streaming error: %s", e)
        yield json.dumps({"type": "error", "content": str(e)})


def parse_files_from_response(full_text: str) -> dict[str, str] | None:
    """Parse multi-file JSON response from AI."""
    text = full_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "files" in data:
            return data["files"]
        return None
    except json.JSONDecodeError:
        # Try to extract JSON from the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start:end])
                if isinstance(data, dict) and "files" in data:
                    return data["files"]
            except json.JSONDecodeError:
                pass
        return None
