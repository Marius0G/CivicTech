# EU Youth Buddy backend — container image for Azure Container Apps.
#
# Build context is the backend/ directory. We bake the already-seeded Chroma DB
# (.chroma, including seed_fingerprint.txt) into the image so the app starts
# instantly with no re-embedding (ensure_index sees a matching fingerprint and
# skips seeding) — that means zero OpenAI cost on boot and no need for a
# persistent volume.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so this layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + the pre-seeded vector DB.
COPY app ./app
COPY .chroma ./.chroma

# Azure Container Apps routes ingress to this port.
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
