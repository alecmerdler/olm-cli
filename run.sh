#!/bin/sh

docker run -it --net=host -e KUBECONFIG -v $KUBECONFIG:$KUBECONFIG quay.io/alecmerdler/olm-cli:latest
