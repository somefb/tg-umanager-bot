# telegram-umanager-bot

This bot helps to manage users in Telegram

NodeJS version: 12+

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## First setup

- Use `npm install`
- Create `./src/appSettings.private.json` with your [bot-token](https://core.telegram.org/bots/api#authorizing-your-bot) like ordinary string kinda `"333111100:Asdfn_FZD123sd3-gw-SKWhgffNAEcQPqE"`
- Create `./src/googleDrive/googleCredentials.json` with setting from googleApi-console

## How to run locally

- Use `npm run serve`

## How to deploy (on AWS Elastic Benstalk)

- Install [EB CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html) (reload Windows after that)
- Build project with `npm run build`
- Generate self-signed certificate with `npm run certificate`
- Remove `.elastibeanstalk` folder
- Deploy with `npm run deploy`

## Do I need to deploy my bot?

It's up to you. Locally started bot depends only on your internet connection and local machine. More details [here](https://core.telegram.org/bots/webhooks)
