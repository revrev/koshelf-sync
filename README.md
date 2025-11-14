[![AGPL Licence][licence-badge]](COPYING)
Koshelf Sync Server
========

Koshelf Sync Server is built on top of the [Gin](http://gin.io) JSON-API
framework which runs on [OpenResty](http://openresty.org/) and is entirely
written in [Lua](http://www.lua.org/). It is a maintained fork of the original
KOReader sync server, renamed to reflect the Koshelf project.

Users of KOReader devices can register their devices to the synchronization
server and use the sync service to keep all reading progress synchronized
between devices.

Audiobookshelf bridge
---------------------

The server can optionally mirror KOreader progress into
[Audiobookshelf](https://www.audiobookshelf.org/) so that audiobook playback and
ebook reading stay in sync. When enabled, every KOreader update is translated
into an Audiobookshelf `PATCH /api/me/progress/:libraryItemId` call that:

* Stores the raw KOreader payload in `mediaProgress.extraData.koreader.rawProgress` so the
  original EPUB CFI and metadata are preserved.
* Computes an approximate audiobook timestamp using the Audiobookshelf track and
  chapter metadata and stores it as `currentTime`, allowing Audiobookshelf
  clients to resume audio at the corresponding location.
* Mirrors the KOreader percentage into `ebookProgress` and `ebookLocation` to
  keep Audiobookshelf aware of the latest e-reading position.

Whenever Audiobookshelf reports new playback progress, the sync server pulls the
latest `mediaProgress` before serving a `GET /syncs/progress/:document` request.
If the Audiobookshelf update is newer than the cached Redis entry, the KOreader
progress is updated with the inferred ebook percentage and the augmented raw
payload, allowing KOreader devices to follow along.

Environment variables control the integration:

| Variable | Description |
| --- | --- |
| `AUDIOBOOKSHELF_BASE_URL` | Base URL of the Audiobookshelf instance (e.g. `https://abs.local:13378`). |
| `AUDIOBOOKSHELF_API_KEY` | Default API key or personal token when no per-user mapping is supplied. |
| `AUDIOBOOKSHELF_USER_ID` | Optional user identifier to call user-scoped progress endpoints. |
| `AUDIOBOOKSHELF_USER_TOKEN` | Optional value forwarded as `X-ABS-User-Token` for token-auth setups. |
| `AUDIOBOOKSHELF_DEVICE_NAME` | Friendly device name to report when Audiobookshelf supplied the update. |
| `AUDIOBOOKSHELF_USER_MAP` | JSON map of KOreader usernames to Audiobookshelf credentials (key, user id, device, token). |
| `AUDIOBOOKSHELF_DOCUMENT_MAP` | JSON map of KOreader document ids to Audiobookshelf `libraryItemId`s. |
| `AUDIOBOOKSHELF_HTTP_TIMEOUT` | Optional HTTP timeout (milliseconds) for Audiobookshelf requests. |

Example `AUDIOBOOKSHELF_USER_MAP` value:

```json
{
  "alice": {
    "api_key": "abs-user-token",
    "user_id": "8f4d8c7d-1f5a-4ab8-a971-2a58b1dd1f1e",
    "device": "Audiobookshelf",
    "user_token": "optional-session-token"
  }
}
```

Example `AUDIOBOOKSHELF_DOCUMENT_MAP` value:

```json
{
  "0b229176d4e8db7f6d2b5a4952368d7a": "lib_itm_01h8cey9q7akb3g1cwvq4vqg5y"
}
```

With the mapping in place the sync server automatically:

1. Persists the raw KOreader payload in Audiobookshelf `extraData` so the bridge
   can accurately translate ebook positions later.
2. Translates KOreader percentages into Audiobookshelf audio timestamps using
   the book's track and chapter metadata.
3. Performs the inverse mapping when Audiobookshelf playback advances and
   refreshes the Redis cache before serving KOreader clients.
4. Leaves the existing Redis contract untouched, so KOreader continues to work
   even if Audiobookshelf is offline.

If you plan to react to Audiobookshelf updates in real time, subscribe to the
`user_item_progress_updated` websocket channel exposed by Audiobookshelf. Doing
so allows a downstream bridge (for example, a KOreader background task) to act
as soon as Audiobookshelf pushes new progress instead of waiting for the next
poll.

Web administration UI
---------------------

A lightweight web console is available at `https://<host>:7200/audiobookshelf`.
Sign in with an existing KoShelf username and password (the page hashes the
password with MD5 before sending the request, matching the reader clients).
Once authenticated you can:

* Edit all Audiobookshelf-related environment overrides, including the base
  URL, credentials, per-user map, and document map, without restarting the
  service.
* Inspect every document stored in Redis along with its local progress, the
  currently linked Audiobookshelf item, and the remote progress pulled from the
  Audiobookshelf API.
* Search Audiobookshelf libraries directly from the UI and link or unlink items
  to KoShelf document identifiers with a single click.
* Monitor recent actions in a scrolling activity log so that configuration
  changes are easy to audit.


This project is licenced under Affero GPL v3, see the [COPYING](COPYING) file.

Setup your own server
======================
Using docker, you can spin up your own server in two commands:

```bash
# for quick test
docker run -d -p 7200:7200 --name=koshelf-sync koshelf/koshelf-sync:latest

# for production, we mount redis data volume to persist state
mkdir -p ./logs/{redis,app} ./data/redis
docker run -d -p 7200:7200 \
    -v `pwd`/logs/app:/app/koshelf-sync/logs \
    -v `pwd`/logs/redis:/var/log/redis \
    -v `pwd`/data/redis:/var/lib/redis \
    --name=koshelf-sync koshelf/koshelf-sync:latest
```

The above command will spin up a sync server in a docker container.

To build your own docker image from scratch:

```bash
docker build --rm=true --tag=koshelf/koshelf-sync .
```

Alternatively, if you'd rather use docker compose:

```bash
docker compose up -d --build
```

To setup the server manually, please refer to the commands used in
[Dockerfile][dockerfile].

You can use the following command to verify that the sync server is ready to serve traffic:

```bash
curl -k -v -H "Accept: application/vnd.koreader.v1+json" https://localhost:7200/healthcheck
# should return {"state":"OK"}
```

As you can see, the server responds over HTTPS using a self-signed certificate. If you'd like to run the server behind a reverse proxy and let the proxy handle TLS termination, run the server on port `17200` instead of `7200`. As an example, your Traefik V3 configuration could look like this:

```bash
  koshelf-sync:
    # ...
    labels:
      - traefik.enable=true
      - 'traefik.http.routers.koshelf-sync.rule=Host(`sync.example.com`)'
      - 'traefik.http.services.koshelf-sync.loadbalancer.server.port=17200'
```

Privacy and security
========

Koshelf sync server does not store file name or file content in the database.
For each user it uses a unique string of 32 digits (MD5 hash) to identify the
same document from multiple KOReader devices and keeps a record of the furthest
reading progress for that document. Sample progress data entries stored in the
sync server are like these:
```
"user:chrox:document:0b229176d4e8db7f6d2b5a4952368d7a:percentage"  --> "0.31879884821061"
"user:chrox:document:0b229176d4e8db7f6d2b5a4952368d7a:progress"    --> "/body/DocFragment[20]/body/p[22]/img.0"
"user:chrox:document:0b229176d4e8db7f6d2b5a4952368d7a:device"      --> "PocketBook"
```
And the account authentication information is stored like this:
```
"user:chrox:key"  --> "1c56000eef209217ec0b50354558ab1a"
```
the password is MD5 hashed at client when authorizing with the sync server.

In addition, all data transferred between KOReader devices and the sync server
are secured by HTTPS (Hypertext Transfer Protocol Secure) connections.

[licence-badge]:http://img.shields.io/badge/licence-AGPL-brightgreen.svg
[dockerfile]:Dockerfile
