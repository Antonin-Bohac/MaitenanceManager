#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Maintenance Manager — Docker Installer
# Cross-platform: Linux, macOS, WSL
# Usage:
#   curl -sL https://raw.githubusercontent.com/Antonin-Bohac/MaitenanceManager/master/install.sh | bash
#   bash install.sh --uninstall
# ─────────────────────────────────────────────────────────────────────────────

readonly APP_NAME="maintenance-manager"
readonly CONTAINER_NAME="maintenance-manager"
readonly IMAGE_NAME="maintenance-manager"
readonly VOLUME_NAME="maintenance-manager-data"
readonly REPO_URL="https://github.com/Antonin-Bohac/MaitenanceManager.git"
readonly START_PORT=8000

# ── Colors ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    DIM='\033[2m'
    RESET='\033[0m'
else
    GREEN='' RED='' YELLOW='' CYAN='' BOLD='' DIM='' RESET=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { printf "${CYAN}%s${RESET}\n" "$*"; }
success() { printf "${GREEN}%s${RESET}\n" "$*"; }
warn()    { printf "${YELLOW}%s${RESET}\n" "$*"; }
error()   { printf "${RED}%s${RESET}\n" "$*" >&2; }
step()    { printf "\n${BOLD}${CYAN}[%s]${RESET} ${BOLD}%s${RESET}\n" "$1" "$2"; }
check()   { printf "  ${GREEN}✓${RESET} %s\n" "$*"; }
cross()   { printf "  ${RED}✗${RESET} %s\n" "$*"; }

spinner() {
    local pid=$1
    local msg="${2:-Building}"
    local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    # Hide cursor
    tput civis 2>/dev/null || true

    while kill -0 "$pid" 2>/dev/null; do
        local c="${chars:i%${#chars}:1}"
        printf "\r  ${CYAN}%s${RESET} %s" "$c" "$msg"
        i=$(( i + 1 ))
        sleep 0.1 || true
    done

    # Show cursor, clear line
    tput cnorm 2>/dev/null || true
    printf "\r\033[K"
}

draw_box() {
    local -a lines=()
    local max_len=0

    while IFS= read -r line; do
        lines+=("$line")
        local stripped
        stripped=$(printf '%s' "$line" | sed 's/\x1b\[[0-9;]*m//g')
        (( ${#stripped} > max_len )) && max_len=${#stripped}
    done

    local width=$((max_len + 2))

    printf "${BOLD}${CYAN}╔"
    printf '═%.0s' $(seq 1 "$width")
    printf "╗${RESET}\n"

    for line in "${lines[@]}"; do
        local stripped
        stripped=$(printf '%s' "$line" | sed 's/\x1b\[[0-9;]*m//g')
        local pad=$((max_len - ${#stripped}))
        printf "${BOLD}${CYAN}║${RESET} %s%*s ${BOLD}${CYAN}║${RESET}\n" "$line" "$pad" ""
    done

    printf "${BOLD}${CYAN}╚"
    printf '═%.0s' $(seq 1 "$width")
    printf "╝${RESET}\n"
}

detect_platform() {
    local uname_s
    uname_s="$(uname -s)"
    case "$uname_s" in
        Linux*)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        Darwin*) echo "macos" ;;
        *)       echo "unknown" ;;
    esac
}

docker_download_url() {
    case "$(detect_platform)" in
        macos) echo "https://docs.docker.com/desktop/install/mac-install/" ;;
        wsl)   echo "https://docs.docker.com/desktop/install/windows-install/" ;;
        linux) echo "https://docs.docker.com/engine/install/" ;;
        *)     echo "https://docs.docker.com/get-docker/" ;;
    esac
}

port_is_free() {
    local port=$1
    if command -v ss &>/dev/null; then
        ! ss -tuln 2>/dev/null | grep -qE ":${port}\b"
    elif command -v lsof &>/dev/null; then
        ! lsof -i :"$port" &>/dev/null
    elif command -v nc &>/dev/null; then
        ! nc -z 127.0.0.1 "$port" 2>/dev/null
    else
        # Assume free if we can't check
        return 0
    fi
}

find_free_port() {
    local port=$START_PORT
    while ! port_is_free "$port"; do
        ((port++))
        if (( port > 65535 )); then
            error "No free port found (tried $START_PORT-65535)."
            exit 1
        fi
    done
    echo "$port"
}

cleanup_temp() {
    if [[ -n "${TEMP_DIR:-}" && -d "${TEMP_DIR:-}" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# ── Uninstall ────────────────────────────────────────────────────────────────
do_uninstall() {
    printf "\n"
    draw_box <<EOF
${RED}${BOLD}Maintenance Manager — Uninstaller${RESET}
EOF
    printf "\n"

    warn "The following Docker resources will be removed:"
    printf "\n"
    info "  Container : $CONTAINER_NAME"
    info "  Image     : $IMAGE_NAME"
    info "  Volume    : $VOLUME_NAME"
    printf "\n"
    warn "WARNING: Removing the volume will delete all application data."
    printf "\n"
    printf "${BOLD}Type 'yes' to confirm: ${RESET}"
    read -r confirmation

    if [[ "$confirmation" != "yes" ]]; then
        info "Uninstall cancelled."
        exit 0
    fi

    printf "\n"

    # Stop and remove container
    if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
        printf "  Stopping container..."
        docker stop "$CONTAINER_NAME" &>/dev/null || true
        docker rm "$CONTAINER_NAME" &>/dev/null || true
        check "Container removed"
    else
        check "Container not found (already removed)"
    fi

    # Remove image
    if docker images --format '{{.Repository}}' | grep -qx "$IMAGE_NAME"; then
        printf "  Removing image..."
        docker rmi "$IMAGE_NAME" &>/dev/null || true
        check "Image removed"
    else
        check "Image not found (already removed)"
    fi

    # Remove volume
    if docker volume ls --format '{{.Name}}' | grep -qx "$VOLUME_NAME"; then
        printf "  Removing volume..."
        docker volume rm "$VOLUME_NAME" &>/dev/null || true
        check "Volume removed"
    else
        check "Volume not found (already removed)"
    fi

    printf "\n"
    success "Maintenance Manager has been completely removed."
    printf "\n"
    exit 0
}

# ── Main Install ─────────────────────────────────────────────────────────────
do_install() {
    trap cleanup_temp EXIT

    # ── Step 1: Banner ───────────────────────────────────────────────────
    printf "\n"
    draw_box <<EOF
${BOLD}  Maintenance Manager Installer${RESET}
${DIM}  Docker-based deployment${RESET}
EOF
    printf "\n"

    # ── Step 2: Docker Check ─────────────────────────────────────────────
    step "1/6" "Checking Docker installation"

    if ! command -v docker &>/dev/null; then
        cross "Docker is not installed"
        printf "\n"
        error "Docker is required but was not found on your system."
        info  "Install Docker from: $(docker_download_url)"
        printf "\n"
        exit 1
    fi
    check "Docker CLI found"

    if ! docker info &>/dev/null 2>&1; then
        cross "Docker daemon is not running"
        printf "\n"
        error "The Docker daemon is not running."
        case "$(detect_platform)" in
            macos) info "Start Docker Desktop from your Applications folder." ;;
            wsl)   info "Start Docker Desktop from the Windows Start menu." ;;
            linux) info "Start the daemon with: sudo systemctl start docker" ;;
        esac
        printf "\n"
        exit 1
    fi

    local docker_version
    docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    check "Docker daemon running (v${docker_version})"

    # ── Step 3: Port Selection ───────────────────────────────────────────
    step "2/6" "Selecting port"

    local port
    port=$(find_free_port)
    check "Port ${port} is available"

    # ── Step 4: Clean up previous install if present ─────────────────────
    step "3/6" "Preparing environment"

    if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
        warn "  Existing container found — removing..."
        docker stop "$CONTAINER_NAME" &>/dev/null || true
        docker rm "$CONTAINER_NAME" &>/dev/null || true
        check "Previous container removed"
    else
        check "No previous container"
    fi

    # ── Step 5: Build Image ──────────────────────────────────────────────
    step "4/6" "Building Docker image"

    TEMP_DIR=$(mktemp -d)

    # Write Dockerfile
    cat > "$TEMP_DIR/Dockerfile" <<'DOCKERFILE'
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && \
    git clone -b master --single-branch https://github.com/Antonin-Bohac/MaitenanceManager.git /tmp/repo && \
    cp -r /tmp/repo/app /app/app && \
    cp /tmp/repo/requirements.txt /app/ && \
    cp -r /tmp/repo/seed /app/seed && \
    apt-get remove -y git && apt-get autoremove -y && \
    rm -rf /tmp/repo /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV DATA_DIR=/app/data

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
DOCKERFILE

    # Write entrypoint.sh
    cat > "$TEMP_DIR/entrypoint.sh" <<'ENTRYPOINT'
#!/bin/bash
set -e

if [ ! -f /app/data/maintenance.db ]; then
    mkdir -p /app/data
    cp /app/seed/maintenance.db /app/data/maintenance.db
    echo "Seed database loaded."
fi

python -m app.migrate

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
ENTRYPOINT

    chmod +x "$TEMP_DIR/entrypoint.sh"

    # Build with spinner
    local build_log="$TEMP_DIR/build.log"
    docker build --no-cache -t "$IMAGE_NAME" "$TEMP_DIR" > "$build_log" 2>&1 &
    local build_pid=$!

    spinner "$build_pid" "Building image (this may take a minute)..." || true

    if wait "$build_pid"; then
        check "Image built successfully"
    else
        cross "Image build failed"
        printf "\n"
        error "Build log:"
        cat "$build_log" >&2
        printf "\n"
        exit 1
    fi

    # Clean up temp dir early
    rm -rf "$TEMP_DIR"
    TEMP_DIR=""

    # ── Step 6: Start Container ──────────────────────────────────────────
    step "5/6" "Starting container"

    # Create volume if it doesn't exist
    docker volume create "$VOLUME_NAME" &>/dev/null
    check "Volume '${VOLUME_NAME}' ready"

    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "${port}:8000" \
        -v "${VOLUME_NAME}:/app/data" \
        --restart unless-stopped \
        "$IMAGE_NAME" &>/dev/null

    check "Container started on port ${port}"

    # Health check — wait for HTTP 200
    step "6/6" "Waiting for application"

    local retries=30
    local healthy=false

    for (( i=1; i<=retries; i++ )); do
        local c
        local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        c="${chars:i%${#chars}:1}"
        printf "\r  ${CYAN}%s${RESET} Checking health (%d/%d)" "$c" "$i" "$retries"

        if curl -sf "http://localhost:${port}/" -o /dev/null 2>/dev/null; then
            healthy=true
            break
        fi
        sleep 2
    done
    printf "\r\033[K"

    if $healthy; then
        check "Application is healthy"
    else
        warn "Health check timed out — the app may still be starting."
        warn "Check logs with: docker logs $CONTAINER_NAME"
    fi

    # ── Completion Summary ───────────────────────────────────────────────
    printf "\n"
    draw_box <<EOF
${GREEN}${BOLD}  Installation complete${RESET}

${BOLD}  URL:${RESET}       ${CYAN}http://localhost:${port}${RESET}
${BOLD}  Status:${RESET}    ${GREEN}Running${RESET}

${DIM}  Management commands:${RESET}
    docker stop   ${CONTAINER_NAME}
    docker start  ${CONTAINER_NAME}
    docker restart ${CONTAINER_NAME}
    docker logs   ${CONTAINER_NAME}
    bash install.sh --uninstall
EOF
    printf "\n"
}

# ── Entrypoint ───────────────────────────────────────────────────────────────
main() {
    for arg in "$@"; do
        case "$arg" in
            --uninstall|-u)
                do_uninstall
                ;;
            --help|-h)
                printf "Usage: %s [--uninstall]\n" "$0"
                printf "\n"
                printf "  --uninstall  Remove container, image, and volume\n"
                printf "  --help       Show this help\n"
                exit 0
                ;;
            *)
                error "Unknown option: $arg"
                printf "Usage: %s [--uninstall]\n" "$0"
                exit 1
                ;;
        esac
    done

    do_install
}

main "$@"
