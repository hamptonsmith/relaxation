#!/bin/bash

# sudo microk8s inspect

iptables -P FORWARD ACCEPT

if ! dpkg -l | grep iptables-persistent &>/dev/null; then
    # Skip interactive prompt
    # https://gist.github.com/alonisser/a2c19f5362c2091ac1e7?permalink_comment_id=2264059#gistcomment-2264059
    echo iptables-persistent iptables-persistent/autosave_v4 boolean true \
            | sudo debconf-set-selections
    echo iptables-persistent iptables-persistent/autosave_v6 boolean true \
            | sudo debconf-set-selections
    
    apt-get install -y iptables-persistent
fi

if ! which node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    apt-get install -y nodejs
fi

echo '{
    "insecure-registries" : ["localhost:32000"]
}' > /etc/docker/daemon.json
