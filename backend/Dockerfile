FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE ${PORT}

# Use a single worker for Railway's smaller instances
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
