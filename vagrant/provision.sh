#!/bin/bash

# sudo microk8s inspect

iptables -P FORWARD ACCEPT

if ! dpkg -l | grep iptables-persistent &>/dev/null; then
    apt-get install -y iptables-persistent
fi

if ! which node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    apt-get install -y nodejs
fi

echo '{
    "insecure-registries" : ["localhost:32000"]
}' > /etc/docker/daemon.json
