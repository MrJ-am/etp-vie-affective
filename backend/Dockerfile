# syntax=docker/dockerfile:1
FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587
RUN --mount=type=secret,id=proxy_ca,target=/run/secrets/proxy_ca \
    apt-get update && apt-get install -y --no-install-recommends \
    sbcl cl-hunchentoot cl-postmodern cl-yason cl-ironclad cl-babel cl-alexandria ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV XDG_CACHE_HOME=/opt/carnet-cache
RUN sbcl --noinform --disable-debugger \
    --eval '(require :asdf)' \
    --eval '(mapc (function asdf:load-system) (list :hunchentoot :postmodern :yason :ironclad :babel))' \
    --quit >/tmp/lisp-dependencies.log 2>&1 || (tail -n 25 /tmp/lisp-dependencies.log; exit 1)
WORKDIR /app
COPY backend /app/backend
RUN CARNET_LIBRARY_ONLY=true \
    sbcl --noinform --disable-debugger --load backend/server.lisp \
    --eval '(multiple-value-bind (file warnings failure) (compile-file "backend/server.lisp" :output-file "backend/server.fasl") (declare (ignore file warnings)) (when failure (uiop:quit 1)))' \
    --quit >/tmp/lisp-build.log 2>&1 || (tail -n 30 /tmp/lisp-build.log; exit 1)
COPY dist /app/dist
RUN useradd --system --uid 10001 --home /nonexistent carnet && chmod -R a+rX /app /opt/carnet-cache \
    && mkdir -p /var/lib/carnet && chown carnet /var/lib/carnet && chmod 700 /var/lib/carnet
USER carnet
EXPOSE 3000
CMD ["sbcl", "--noinform", "--disable-debugger", "--load", "backend/server.fasl"]
