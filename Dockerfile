FROM node:20-bookworm AS frontend-builder
ARG VITE_BASE_PATH=/react/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
WORKDIR /frontend

COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./ 
COPY frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/eslint.config.js ./ 
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM ubuntu:jammy

ENV DEBIAN_FRONTEND="noninteractive" \
    LANG="en_US.UTF-8" \
    LANGUAGE="en_US:en" \
    LC_ALL="en_US.UTF-8"

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        build-essential \
        ca-certificates \
        git \
        libncurses5-dev \
        libpcre3-dev \
        libreadline-dev \
        libssl-dev \
        locales \
        luarocks \
        openssl \
        redis-server \
        unzip \
        wget \
        zlib1g-dev \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ARG OPENRESTY_VER=1.21.4.1
ENV PATH="/opt/openresty/nginx/sbin:${PATH}"

WORKDIR /app

RUN set -eux; \
    wget -O openresty.tar.gz "https://openresty.org/download/openresty-${OPENRESTY_VER}.tar.gz"; \
    tar zxvf openresty.tar.gz; \
    cd "openresty-${OPENRESTY_VER}"; \
    ./configure --prefix=/opt/openresty; \
    make -j"$(nproc)" && make install; \
    cd /app; \
    rm -rf "openresty-${OPENRESTY_VER}" openresty.tar.gz /tmp/*

RUN mkdir -p /etc/nginx/ssl \
    && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/nginx.key \
        -out /etc/nginx/ssl/nginx.crt \
        -subj "/"

RUN luarocks install --verbose luasocket \
    && luarocks install luasec \
    && luarocks install redis-lua \
    && luarocks install busted \
    && rm -rf /tmp/*

# add app source code
COPY ./ koshelf-sync
RUN mkdir -p koshelf-sync/public/react
COPY --from=frontend-builder /frontend/dist koshelf-sync/public/react

# patch gin for https support
RUN git clone https://github.com/ostinelli/gin \
    && cd gin \
    && luarocks make \
    && cd /app \
    && rm -rf gin /tmp/*

ENV GIN_ENV="production"

RUN echo "daemon off;" >> koshelf-sync/config/nginx.conf \
    && mkdir -p /var/log/redis /var/lib/redis

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME ["/var/log/redis", "/var/lib/redis"]

EXPOSE 7200
CMD ["/usr/local/bin/entrypoint.sh"]
