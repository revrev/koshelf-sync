VERSION=2.0
IMAGE=koshelf/koshelf-sync

build:
	docker build --rm=true --tag=$(IMAGE):$(VERSION) .
	docker tag $(IMAGE):$(VERSION) $(IMAGE):latest

push:
	docker push $(IMAGE):$(VERSION)
	docker push $(IMAGE):latest
