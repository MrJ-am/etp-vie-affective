# syntax=docker/dockerfile:1
FROM rust:1.90-slim-bookworm@sha256:64232e656c058f4468e8d024e990acff04f0fd5a5c0a88a574dc37773d7325c9 AS build
WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export CARGO_HTTP_CAINFO=/run/secrets/proxy_ca; fi; \
    cargo build --release --locked
FROM debian:bookworm-slim@sha256:7ff6ba31527b9e336162fa061746c366c4b2032f4d2cff2078bea43f78efe3f8
RUN useradd --system --uid 10001 --home /nonexistent carnet \
    && mkdir -p /var/lib/carnet && chown carnet /var/lib/carnet && chmod 700 /var/lib/carnet
WORKDIR /app
COPY --from=build /app/target/release/etp-carnet-server /usr/local/bin/etp-carnet-server
COPY dist /app/dist
RUN chmod -R a+rX /app/dist
USER carnet
EXPOSE 3000
CMD ["etp-carnet-server"]
