FROM alpine:3.7

WORKDIR /usr/src/olm

RUN apk add --no-cache nodejs 
COPY --from=lachlanevenson/k8s-kubectl:v1.10.3 /usr/local/bin/kubectl /usr/local/bin/kubectl
COPY . . 
RUN npm install

ENTRYPOINT ["node", "index.js"]
