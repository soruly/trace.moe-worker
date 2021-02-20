# trace.moe-worker

[![License](https://img.shields.io/github/license/soruly/trace.moe-worker.svg?style=flat-square)](https://github.com/soruly/trace.moe-worker/blob/master/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/soruly/trace.moe-worker/Node.js%20CI?style=flat-square)](https://github.com/soruly/trace.moe-worker/actions)
[![Discord](https://img.shields.io/discord/437578425767559188.svg?style=flat-square)](https://discord.gg/K9jn6Kj)

Backend workers for [trace.moe](https://github.com/soruly/trace.moe)

### Features

- watch file system changes and upload hash to trace.moe-media
- download video from trace.moe-media, hash, and upload to trace.moe-api
- download hash from trace.moe-api, deduplicate, and upload to solr

### Prerequisites

- Node.js 14.x
- ffmpeg 4.x
- java (openjdk 1.8.0)
- git
- [pm2](https://pm2.keymetrics.io/)

### Install

Install Prerequisites first, then:

```
git clone https://github.com/soruly/trace.moe-worker.git
cd trace.moe-worker
npm install
```

### Configuration

- Copy `.env.example` to `.env`
- Edit `.env` as appropriate for your setup

### Start workers

You can use pm2 to run this in background in cluster mode.

Use below commands to start / restart / stop server.

```
npm run start
npm run stop
npm run reload
npm run restart
npm run delete
```

To change the number of nodejs instances, edit ecosystem.config.json
