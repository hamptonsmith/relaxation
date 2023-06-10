#!/bin/bash

apt-get install -qqy jq

npm remove -g @shieldsbetter/pelton
cd /live-pelton
npm link