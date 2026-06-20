# Root Dockerfile for platforms that only build ./Dockerfile by default
# (for example EasyPanel application services).
#
# It mirrors deploy/docker/Dockerfile.unified: build the React frontend first,
# then run FastAPI on port 8080 and serve the compiled frontend from the
# backend package. PostgreSQL is required at runtime via DATABASE_URL.

FROM node:22-alpine AS frontend-build

WORKDIR /build
ENV NODE_OPTIONS=--max-old-space-size=6144
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r oe && useradd -r -g oe -d /app -s /sbin/nologin oe

WORKDIR /app

COPY backend/ backend/

RUN mkdir -p /app/frontend/dist
COPY --from=frontend-build /build/dist backend/app/_frontend_dist/

RUN pip install --no-cache-dir "./backend[server]" \
    && pip install --no-cache-dir "ezdxf>=0.18.0" || true

COPY data/ data/
COPY --chmod=0755 deploy/docker/entrypoint.sh /app/entrypoint.sh

RUN mkdir -p /data \
    && chown oe:oe /data \
    && chown -R oe:oe /app

USER oe

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SERVE_FRONTEND=true \
    VECTOR_BACKEND=lancedb \
    VECTOR_DATA_DIR=/data/vectors \
    APP_ENV=development \
    APP_DEBUG=false \
    ALLOWED_ORIGINS=*

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
