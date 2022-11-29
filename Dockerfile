FROM nginx:1.23.2

RUN set -eux \
    export DEBIAN_FRONTEND=noninteractive;  \
    apt-get update -qq; \
    apt-get install --no-install-recommends --no-install-suggests --reinstall --yes make git gcc curl libpcre2-dev libssl-dev zlib1g-dev ca-certificates libreadline-dev;

RUN set -eux \
    cd /tmp; \
    mkdir njs; \
    cd njs; \
    git clone -b 0.7.9 https://github.com/nginx/njs.git .; \
    ./configure; \
    make; \
    cp build/njs /usr/local/bin;