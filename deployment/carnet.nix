# Exemple non appliqué : compléter domaine, image/digest et secrets hors dépôt.
{ config, pkgs, ... }:
let
  siteDomain = "carnet.example.invalid";
  image = "registry.example.invalid/mon-carnet@sha256:REMPLACER_PAR_DIGEST_VERIFIE";
in {
  virtualisation.docker.enable = true;
  virtualisation.oci-containers.backend = "docker";
  virtualisation.oci-containers.containers.etp-carnet = {
    inherit image;
    ports = [ "127.0.0.1:3017:3000" ];
    volumes = [ "/var/lib/etp-carnet:/var/lib/carnet" ];
    environmentFiles = [ "/run/secrets/etp-carnet-environment" ];
    environment = {
      CARNET_PUBLIC_URL = "https://${siteDomain}";
      CARNET_SECURE_COOKIE = "true";
      CARNET_DB_HOST = "host.docker.internal";
      CARNET_DB_NAME = "etp_carnet";
      CARNET_DB_USER = "etp_carnet";
      CARNET_RETENTION_DAYS = "90";
    };
    extraOptions = [ "--add-host=host.docker.internal:host-gateway" ];
  };
  services.postgresql = {
    enable = true;
    package = pkgs.postgresql_17;
    ensureDatabases = [ "etp_carnet" ];
    ensureUsers = [ { name = "etp_carnet"; ensureDBOwnership = true; } ];
    # Configurer SCRAM et l’accès de l’interface bridge Docker explicitement,
    # sans ouvrir PostgreSQL sur Internet. Ne pas utiliser trust.
  };
  systemd.tmpfiles.rules = [ "d /var/lib/etp-carnet 0700 10001 10001 -" ];
  services.nginx = {
    enable = true;
    virtualHosts.${siteDomain} = {
      forceSSL = true;
      enableACME = true;
      extraConfig = "client_max_body_size 4000000; access_log off;";
      locations."/" = {
        proxyPass = "http://127.0.0.1:3017";
        extraConfig = "proxy_read_timeout 20s; proxy_send_timeout 20s;";
      };
    };
  };
  # Définir email/acceptation ACME et DNS uniquement dans le déploiement autorisé.
}
