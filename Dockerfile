FROM nginx:1.23.2

SHELL ["/bin/bash", "-c"]

ADD .tool-versions .

RUN set -eux \
    export DEBIAN_FRONTEND=noninteractive;  \
    cat .tool-versions > $HOME/.tool-versions; \
    apt-get update -qq; \
    apt-get install --no-install-recommends --no-install-suggests --reinstall --yes make git gcc curl libpcre2-dev libssl-dev zlib1g-dev ca-certificates libreadline-dev; \
    cd /tmp; \
    mkdir njs; \
    cd njs; \
    git clone -b 0.7.9 https://github.com/nginx/njs.git .; \
    ./configure; \
    make; \
    cp build/njs /usr/local/bin; \
    git clone https://github.com/asdf-vm/asdf.git $HOME/.asdf --branch v0.10.0; \
    echo -e '\nsource $HOME/.asdf/asdf.sh' >> ~/.bashrc; \
    source ~/.bashrc; \
    asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git; \
    asdf nodejs update-nodebuild; \
    asdf install; \
    npm install -g npm@latest;
    
WORKDIR /usr/local/src/njs-memory-profiler
