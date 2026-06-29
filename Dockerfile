# Root Dockerfile for platforms that only build ./Dockerfile by default
# (for example EasyPanel application services).
#
# It mirrors deploy/docker/Dockerfile.unified: build the React frontend first,
# then run FastAPI on port 8080 and serve the compiled frontend from the
# backend package. PostgreSQL is required at runtime via DATABASE_URL.

FROM node:22-alpine AS frontend-build

WORKDIR /build
ENV NODE_OPTIONS=--max-old-space-size=8192
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

# Tolerant healthcheck: a heavy DWG/IFC conversion saturates the single worker
# and can make /api/health take several seconds for a while. The old
# timeout=5s/retries=3 marked the container unhealthy and restarted it MID-
# conversion (killing the job and returning 502s during the ~30s reboot).
# Generous timeout + retries + a longer start-period (the app loads 125 modules
# on boot) keep transient slowness from triggering a false-unhealthy restart.
HEALTHCHECK --interval=30s --timeout=30s --start-period=90s --retries=6 \
    CMD curl -fsS --max-time 25 http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
