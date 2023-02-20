FROM node:18
COPY package*.json .

# If we're included as a pelton dependency, we likely won't have access to
# package-lock.json (which isn't published to npm), so we `install` first.
RUN npm install && npm ci

COPY . .
ENTRYPOINT []
CMD ["sh", "-c", "${RUN_TESTS}"]